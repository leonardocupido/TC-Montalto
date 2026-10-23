from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from models.tennis import MemberDetail, MemberStats, MemberSummary
from routers.matches import _aware, build_matches, cutoff_30d, played_matches

router = APIRouter(prefix="/members", tags=["members"])


@router.get("", response_model=list[MemberSummary])
async def list_members(user: dict = Depends(current_user)):
    docs = await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "level": 1}).sort("name", 1).to_list(2000)
    cutoff = cutoff_30d()
    out = []
    for d in docs:
        played = await played_matches(d["id"], cutoff)
        out.append(
            MemberSummary(id=d["id"], name=d["name"], level=d.get("level", ""), is_me=d["id"] == user["id"], played_30d=len(played))
        )
    # Me first, then alphabetical.
    out.sort(key=lambda m: (not m.is_me, m.name.lower()))
    return out


@router.get("/{id}", response_model=MemberDetail)
async def get_member(id: str, user: dict = Depends(current_user)):
    doc = await db.users.find_one({"id": id}, {"_id": 0, "password_hash": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Socio non trovato")
    all_played = await played_matches(id)
    recent = await played_matches(id, cutoff_30d())
    types = list(all_played.values())
    # Live (not cancelled) proposals + archived ones whose match was already cleaned up.
    proposed = await db.matches.count_documents({"owner_id": id, "status": {"$ne": "annullata"}})
    proposed += await db.played_history.count_documents({"user_id": id, "owner": True})
    accepted_ids = [
        a["match_id"]
        for a in await db.applications.find({"user_id": id, "status": "accettata"}, {"match_id": 1}).to_list(1000)
    ]
    upcoming_docs = (
        await db.matches.find(
            {
                "date": {"$gte": today_iso("Europe/Rome")},
                "status": {"$ne": "annullata"},
                "$or": [{"owner_id": id}, {"id": {"$in": accepted_ids}}],
            },
            {"_id": 0},
        )
        .sort([("date", 1), ("time", 1)])
        .to_list(50)
    )
    created = doc.get("created_at")
    return MemberDetail(
        id=doc["id"],
        name=doc["name"],
        email=doc.get("email", ""),
        phone=doc.get("phone", ""),
        level=doc.get("level", ""),
        member_since=_aware(created) if created else None,
        is_me=id == user["id"],
        stats=MemberStats(
            played_total=len(types),
            played_30d=len(recent),
            singoli=types.count("singolo"),
            doppi=types.count("doppio"),
            proposed_total=proposed,
        ),
        upcoming=await build_matches(upcoming_docs, user["id"]),
    )
