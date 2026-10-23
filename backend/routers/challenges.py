import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from models.tennis import Challenge, ChallengeList, ScheduleIn
from routers.matches import _aware

router = APIRouter(tags=["challenges"])

# Flow: in_attesa --accept--> accettata (da programmare) --schedule(date,time)--> programmata (confirmed singolo created)
#       in_attesa --reject--> rifiutata


def to_challenge(doc: dict, viewer_id: str) -> Challenge:
    received = doc["challenged_id"] == viewer_id
    unseen = not doc.get("seen_by_challenged", True) if received else not doc.get("result_seen", True)
    return Challenge(
        id=doc["id"],
        challenger_id=doc["challenger_id"],
        challenger_name=doc["challenger_name"],
        challenger_level=doc.get("challenger_level", ""),
        challenged_id=doc["challenged_id"],
        challenged_name=doc["challenged_name"],
        date=doc.get("date"),
        time=doc.get("time"),
        status=doc["status"],
        scheduled_by=doc.get("scheduled_by"),
        match_id=doc.get("match_id"),
        unseen=unseen,
        created_at=_aware(doc["created_at"]),
    )


async def _get(id: str) -> dict:
    doc = await db.challenges.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Sfida non trovata")
    return doc


async def _notify_other(doc: dict, actor_id: str) -> None:
    """Flag the challenge as unseen for the participant who did NOT perform the action."""
    field = "seen_by_challenged" if actor_id == doc["challenger_id"] else "result_seen"
    await db.challenges.update_one({"id": doc["id"]}, {"$set": {field: False}})
    doc[field] = False


@router.post("/members/{id}/challenge", response_model=Challenge)
async def create_challenge(id: str, user: dict = Depends(current_user)):
    """Only sends the 'you have been challenged' notice; date and time are set after acceptance."""
    if id == user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi sfidare te stesso")
    target = await db.users.find_one({"id": id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Socio non trovato")
    if await db.challenges.find_one(
        {"challenger_id": user["id"], "challenged_id": id, "status": {"$in": ["in_attesa", "accettata"]}}
    ):
        raise HTTPException(status_code=400, detail="Hai già una sfida aperta con questo socio")
    doc = {
        "id": str(uuid.uuid4()),
        "challenger_id": user["id"],
        "challenger_name": user["name"],
        "challenger_level": user.get("level", ""),
        "challenged_id": id,
        "challenged_name": target["name"],
        "status": "in_attesa",
        "seen_by_challenged": False,
        "result_seen": True,
        "created_at": datetime.now(timezone.utc),
    }
    await db.challenges.insert_one(doc)
    return to_challenge(doc, user["id"])


@router.get("/challenges", response_model=ChallengeList)
async def list_challenges(user: dict = Depends(current_user)):
    received = await db.challenges.find({"challenged_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    sent = await db.challenges.find({"challenger_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return ChallengeList(
        received=[to_challenge(d, user["id"]) for d in received],
        sent=[to_challenge(d, user["id"]) for d in sent],
    )


async def _pending_received(id: str, user: dict) -> dict:
    doc = await _get(id)
    if doc["challenged_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Solo lo sfidato può rispondere")
    if doc["status"] != "in_attesa":
        raise HTTPException(status_code=400, detail="Sfida già gestita")
    return doc


@router.post("/challenges/{id}/accept", response_model=Challenge)
async def accept_challenge(id: str, user: dict = Depends(current_user)):
    doc = await _pending_received(id, user)
    await db.challenges.update_one({"id": id}, {"$set": {"status": "accettata", "seen_by_challenged": True}})
    doc.update(status="accettata", seen_by_challenged=True)
    await _notify_other(doc, user["id"])
    return to_challenge(doc, user["id"])


@router.post("/challenges/{id}/reject", response_model=Challenge)
async def reject_challenge(id: str, user: dict = Depends(current_user)):
    doc = await _pending_received(id, user)
    await db.challenges.update_one({"id": id}, {"$set": {"status": "rifiutata", "seen_by_challenged": True}})
    doc.update(status="rifiutata", seen_by_challenged=True)
    await _notify_other(doc, user["id"])
    return to_challenge(doc, user["id"])


@router.post("/challenges/{id}/schedule", response_model=Challenge)
async def schedule_challenge(id: str, body: ScheduleIn, user: dict = Depends(current_user)):
    """Either player sets date and time of an accepted challenge -> confirmed singolo in bacheca."""
    doc = await _get(id)
    if user["id"] not in (doc["challenger_id"], doc["challenged_id"]):
        raise HTTPException(status_code=403, detail="Solo i due sfidanti possono programmare la partita")
    if doc["status"] != "accettata":
        raise HTTPException(status_code=400, detail="La sfida non è da programmare")
    if body.date < today_iso("Europe/Rome"):
        raise HTTPException(status_code=400, detail="La data non può essere nel passato")
    challenger = await db.users.find_one({"id": doc["challenger_id"]}, {"_id": 0}) or {}
    challenged = await db.users.find_one({"id": doc["challenged_id"]}, {"_id": 0}) or {}
    now = datetime.now(timezone.utc)
    match_id = str(uuid.uuid4())
    await db.matches.insert_one({
        "id": match_id,
        "owner_id": doc["challenger_id"],
        "owner_name": doc["challenger_name"],
        "owner_level": challenger.get("level", doc.get("challenger_level", "")),
        "type": "singolo",
        "date": body.date,
        "time": body.time,
        "level": "Sfida",
        "notes": f"Sfida di {doc['challenger_name']} a {doc['challenged_name']}",
        "status": "confermata",
        "challenge_id": doc["id"],
        "created_at": now,
    })
    await db.applications.insert_one({
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "user_id": doc["challenged_id"],
        "user_name": doc["challenged_name"],
        "user_level": challenged.get("level", ""),
        "phone": challenged.get("phone", ""),
        "message": "Sfida accettata",
        "status": "accettata",
        "applicant_seen": True,
        "created_at": now,
    })
    upd = {"status": "programmata", "date": body.date, "time": body.time, "match_id": match_id, "scheduled_by": user["id"]}
    await db.challenges.update_one({"id": id}, {"$set": upd})
    doc.update(upd)
    await _notify_other(doc, user["id"])
    return to_challenge(doc, user["id"])


@router.post("/challenges/seen")
async def mark_challenges_seen(user: dict = Depends(current_user)):
    """User opened 'Sfide': clear challenge notifications on both sides."""
    await db.challenges.update_many({"challenged_id": user["id"], "seen_by_challenged": False}, {"$set": {"seen_by_challenged": True}})
    await db.challenges.update_many({"challenger_id": user["id"], "result_seen": False}, {"$set": {"result_seen": True}})
    return {"ok": True}
