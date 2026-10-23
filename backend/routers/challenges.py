import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from models.tennis import Challenge, ChallengeIn, ChallengeList
from routers.matches import _aware

router = APIRouter(tags=["challenges"])


def to_challenge(doc: dict, viewer_id: str) -> Challenge:
    received = doc["challenged_id"] == viewer_id
    # Received: unseen until opened. Sent: unseen once answered, until opened.
    unseen = not doc.get("seen_by_challenged", True) if received else not doc.get("result_seen", True)
    return Challenge(
        id=doc["id"],
        challenger_id=doc["challenger_id"],
        challenger_name=doc["challenger_name"],
        challenger_level=doc.get("challenger_level", ""),
        challenged_id=doc["challenged_id"],
        challenged_name=doc["challenged_name"],
        date=doc["date"],
        time=doc["time"],
        message=doc.get("message", ""),
        status=doc["status"],
        expired=doc["status"] == "in_attesa" and doc["date"] < today_iso("Europe/Rome"),
        match_id=doc.get("match_id"),
        unseen=unseen,
        created_at=_aware(doc["created_at"]),
    )


@router.post("/members/{id}/challenge", response_model=Challenge)
async def create_challenge(id: str, body: ChallengeIn, user: dict = Depends(current_user)):
    if id == user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi sfidare te stesso")
    target = await db.users.find_one({"id": id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Socio non trovato")
    if body.date < today_iso("Europe/Rome"):
        raise HTTPException(status_code=400, detail="La data non può essere nel passato")
    if await db.challenges.find_one({"challenger_id": user["id"], "challenged_id": id, "status": "in_attesa"}):
        raise HTTPException(status_code=400, detail="Hai già una sfida in attesa con questo socio")
    doc = {
        "id": str(uuid.uuid4()),
        "challenger_id": user["id"],
        "challenger_name": user["name"],
        "challenger_level": user.get("level", ""),
        "challenged_id": id,
        "challenged_name": target["name"],
        "date": body.date,
        "time": body.time,
        "message": body.message.strip(),
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
    doc = await db.challenges.find_one({"id": id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Sfida non trovata")
    if doc["challenged_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Solo lo sfidato può rispondere")
    if doc["status"] != "in_attesa":
        raise HTTPException(status_code=400, detail="Sfida già gestita")
    return doc


@router.post("/challenges/{id}/accept", response_model=Challenge)
async def accept_challenge(id: str, user: dict = Depends(current_user)):
    doc = await _pending_received(id, user)
    if doc["date"] < today_iso("Europe/Rome"):
        raise HTTPException(status_code=400, detail="La sfida è scaduta")
    challenger = await db.users.find_one({"id": doc["challenger_id"]}, {"_id": 0}) or {}
    now = datetime.now(timezone.utc)
    match_id = str(uuid.uuid4())
    # Accepted challenge = confirmed singolo: challenger is proponent, challenged is the accepted player.
    await db.matches.insert_one({
        "id": match_id,
        "owner_id": doc["challenger_id"],
        "owner_name": doc["challenger_name"],
        "owner_level": challenger.get("level", doc.get("challenger_level", "")),
        "type": "singolo",
        "date": doc["date"],
        "time": doc["time"],
        "level": "Sfida",
        "notes": doc.get("message") or f"Sfida di {doc['challenger_name']} a {doc['challenged_name']}",
        "status": "confermata",
        "challenge_id": doc["id"],
        "created_at": now,
    })
    await db.applications.insert_one({
        "id": str(uuid.uuid4()),
        "match_id": match_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "user_level": user.get("level", ""),
        "phone": user.get("phone", ""),
        "message": "Sfida accettata",
        "status": "accettata",
        "applicant_seen": True,
        "created_at": now,
    })
    await db.challenges.update_one(
        {"id": id},
        {"$set": {"status": "accettata", "match_id": match_id, "seen_by_challenged": True, "result_seen": False}},
    )
    doc.update(status="accettata", match_id=match_id, seen_by_challenged=True, result_seen=False)
    return to_challenge(doc, user["id"])


@router.post("/challenges/{id}/reject", response_model=Challenge)
async def reject_challenge(id: str, user: dict = Depends(current_user)):
    doc = await _pending_received(id, user)
    await db.challenges.update_one(
        {"id": id}, {"$set": {"status": "rifiutata", "seen_by_challenged": True, "result_seen": False}}
    )
    doc.update(status="rifiutata", seen_by_challenged=True, result_seen=False)
    return to_challenge(doc, user["id"])


@router.post("/challenges/seen")
async def mark_challenges_seen(user: dict = Depends(current_user)):
    """User opened 'Sfide': received challenges are seen, answers to sent ones acknowledged."""
    await db.challenges.update_many({"challenged_id": user["id"], "seen_by_challenged": False}, {"$set": {"seen_by_challenged": True}})
    await db.challenges.update_many({"challenger_id": user["id"], "result_seen": False}, {"$set": {"result_seen": True}})
    return {"ok": True}
