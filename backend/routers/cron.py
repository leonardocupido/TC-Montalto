import hmac
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from lib.dates import today_iso
from lib.db import db

router = APIRouter(prefix="/cron", tags=["cron"])
logger = logging.getLogger(__name__)


def _check_auth(request: Request) -> None:
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    if not secret or scheme.lower() != "bearer" or not token or not hmac.compare_digest(token, secret):
        raise HTTPException(status_code=401, detail="Unauthorized")


async def delete_past_matches() -> dict:
    """Delete matches whose date is before today (Europe/Rome) together with their applications."""
    today = today_iso("Europe/Rome")
    ids = [d["id"] for d in await db.matches.find({"date": {"$lt": today}}, {"id": 1}).to_list(10000)]
    if not ids:
        return {"matches": 0, "applications": 0}
    apps = await db.applications.delete_many({"match_id": {"$in": ids}})
    res = await db.matches.delete_many({"id": {"$in": ids}})
    logger.info("cleanup-past: deleted %s matches, %s applications", res.deleted_count, apps.deleted_count)
    return {"matches": res.deleted_count, "applications": apps.deleted_count}


async def _run(run_id: str) -> None:
    try:
        result = await delete_past_matches()
        await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"status": "done", "result": result}})
    except Exception as exc:  # log, never crash the worker
        logger.exception("cleanup-past failed")
        await db.cron_runs.update_one({"run_id": run_id}, {"$set": {"status": "failed", "error": str(exc)}})


@router.post("/cleanup-past", status_code=202)
async def cleanup_past(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    _check_auth(request)
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid body")
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid body")
    run_id = request.headers.get("x-webhook-id") or body.get("run_id")
    if not run_id:
        raise HTTPException(status_code=400, detail="Missing run_id")
    try:
        await db.cron_runs.insert_one(
            {"run_id": run_id, "job": "cleanup-past", "status": "queued", "created_at": datetime.now(timezone.utc)}
        )
    except DuplicateKeyError:
        return {"accepted": True, "duplicate": True}
    background.add_task(_run, run_id)
    return {"accepted": True, "duplicate": False}
