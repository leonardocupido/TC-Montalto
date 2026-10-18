import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from lib.auth import current_user
from lib.dates import today_iso
from lib.db import db
from models.tennis import (
    Application,
    ApplyIn,
    Contact,
    Match,
    MatchIn,
    MyApplication,
    OwnedMatch,
    Player,
    Summary,
)

router = APIRouter(tags=["matches"])

SPOTS = {"singolo": 1, "doppio": 3}


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def to_app(doc: dict) -> Application:
    return Application(
        id=doc["id"],
        match_id=doc["match_id"],
        user_id=doc["user_id"],
        user_name=doc["user_name"],
        user_level=doc.get("user_level", ""),
        phone=doc.get("phone", ""),
        message=doc.get("message", ""),
        status=doc["status"],
        created_at=_aware(doc["created_at"]),
    )


async def build_matches(docs: list[dict], user_id: str) -> list[Match]:
    ids = [d["id"] for d in docs]
    apps = await db.applications.find({"match_id": {"$in": ids}}, {"_id": 0}).to_list(5000)
    out: list[Match] = []
    for d in docs:
        m_apps = [a for a in apps if a["match_id"] == d["id"]]
        accepted = [a for a in m_apps if a["status"] == "accettata"]
        mine = next((a for a in m_apps if a["user_id"] == user_id), None)
        total = SPOTS[d["type"]]
        players = [Player(user_id=d["owner_id"], name=d["owner_name"], level=d.get("owner_level", ""))]
        players += [Player(user_id=a["user_id"], name=a["user_name"], level=a.get("user_level", "")) for a in accepted]
        out.append(
            Match(
                id=d["id"],
                owner_id=d["owner_id"],
                owner_name=d["owner_name"],
                owner_level=d.get("owner_level", ""),
                type=d["type"],
                date=d["date"],
                time=d["time"],
                level=d["level"],
                notes=d.get("notes", ""),
                status=d["status"],
                spots_total=total,
                spots_left=max(0, total - len(accepted)),
                players=players,
                is_owner=d["owner_id"] == user_id,
                my_application_status=mine["status"] if mine else None,
                pending_count=sum(1 for a in m_apps if a["status"] == "in_attesa") if d["owner_id"] == user_id else 0,
                created_at=_aware(d["created_at"]),
            )
        )
    return out


async def get_match_doc(match_id: str) -> dict:
    doc = await db.matches.find_one({"id": match_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    return doc


@router.get("/matches", response_model=list[Match])
async def list_matches(type: Optional[str] = None, user: dict = Depends(current_user)):
    q: dict = {"date": {"$gte": today_iso("Europe/Rome")}, "status": {"$ne": "annullata"}}
    if type in SPOTS:
        q["type"] = type
    docs = await db.matches.find(q, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(500)
    return await build_matches(docs, user["id"])


@router.post("/matches", response_model=Match)
async def create_match(body: MatchIn, user: dict = Depends(current_user)):
    if body.date < today_iso("Europe/Rome"):
        raise HTTPException(status_code=400, detail="La data non può essere nel passato")
    doc = {
        "id": str(uuid.uuid4()),
        "owner_id": user["id"],
        "owner_name": user["name"],
        "owner_level": user.get("level", ""),
        **body.model_dump(),
        "status": "aperta",
        "created_at": datetime.now(timezone.utc),
    }
    await db.matches.insert_one(doc)
    return (await build_matches([doc], user["id"]))[0]


@router.delete("/matches/{id}")
async def cancel_match(id: str, user: dict = Depends(current_user)):
    doc = await get_match_doc(id)
    if doc["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Solo il proponente può annullare")
    await db.matches.update_one({"id": id}, {"$set": {"status": "annullata"}})
    await db.applications.update_many(
        {"match_id": id, "status": "in_attesa"}, {"$set": {"status": "rifiutata"}}
    )
    return {"ok": True}


@router.post("/matches/{id}/apply", response_model=Application)
async def apply(id: str, body: ApplyIn, user: dict = Depends(current_user)):
    doc = await get_match_doc(id)
    if doc["owner_id"] == user["id"]:
        raise HTTPException(status_code=400, detail="Non puoi candidarti alla tua partita")
    if doc["status"] != "aperta":
        raise HTTPException(status_code=400, detail="Non ci sono più posti disponibili")
    if await db.applications.find_one({"match_id": id, "user_id": user["id"]}):
        raise HTTPException(status_code=400, detail="Ti sei già candidato a questa partita")
    app_doc = {
        "id": str(uuid.uuid4()),
        "match_id": id,
        "user_id": user["id"],
        "user_name": user["name"],
        "user_level": user.get("level", ""),
        "phone": body.phone.strip(),
        "message": body.message.strip(),
        "status": "in_attesa",
        "created_at": datetime.now(timezone.utc),
    }
    await db.applications.insert_one(app_doc)
    return to_app(app_doc)


async def _owned_app(app_id: str, user: dict) -> tuple[dict, dict]:
    app_doc = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidatura non trovata")
    match = await get_match_doc(app_doc["match_id"])
    if match["owner_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Solo il proponente può decidere")
    if app_doc["status"] != "in_attesa":
        raise HTTPException(status_code=400, detail="Candidatura già gestita")
    return app_doc, match


@router.post("/applications/{id}/accept", response_model=Application)
async def accept(id: str, user: dict = Depends(current_user)):
    app_doc, match = await _owned_app(id, user)
    if match["status"] != "aperta":
        raise HTTPException(status_code=400, detail="La partita è già confermata")
    await db.applications.update_one({"id": id}, {"$set": {"status": "accettata"}})
    accepted = await db.applications.count_documents({"match_id": match["id"], "status": "accettata"})
    if accepted >= SPOTS[match["type"]]:
        await db.matches.update_one({"id": match["id"]}, {"$set": {"status": "confermata"}})
        await db.applications.update_many(
            {"match_id": match["id"], "status": "in_attesa"}, {"$set": {"status": "rifiutata"}}
        )
    app_doc["status"] = "accettata"
    return to_app(app_doc)


@router.post("/applications/{id}/reject", response_model=Application)
async def reject(id: str, user: dict = Depends(current_user)):
    app_doc, _ = await _owned_app(id, user)
    await db.applications.update_one({"id": id}, {"$set": {"status": "rifiutata"}})
    app_doc["status"] = "rifiutata"
    return to_app(app_doc)


@router.get("/me/matches", response_model=list[OwnedMatch])
async def my_matches(user: dict = Depends(current_user)):
    docs = (
        await db.matches.find({"owner_id": user["id"], "status": {"$ne": "annullata"}}, {"_id": 0})
        .sort([("date", 1), ("time", 1)])
        .to_list(500)
    )
    matches = await build_matches(docs, user["id"])
    apps = await db.applications.find(
        {"match_id": {"$in": [d["id"] for d in docs]}}, {"_id": 0}
    ).sort("created_at", 1).to_list(5000)
    return [
        OwnedMatch(match=m, applications=[to_app(a) for a in apps if a["match_id"] == m.id])
        for m in matches
    ]


@router.get("/me/applications", response_model=list[MyApplication])
async def my_applications(user: dict = Depends(current_user)):
    apps = await db.applications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    docs = await db.matches.find({"id": {"$in": [a["match_id"] for a in apps]}}, {"_id": 0}).to_list(500)
    matches = {m.id: m for m in await build_matches(docs, user["id"])}
    owner_ids = list({d["owner_id"] for d in docs})
    owners = {u["id"]: u for u in await db.users.find({"id": {"$in": owner_ids}}, {"_id": 0}).to_list(500)}
    out: list[MyApplication] = []
    for a in apps:
        m = matches.get(a["match_id"])
        if not m:
            continue
        contacts: list[Contact] = []
        if a["status"] == "accettata":
            owner = owners.get(m.owner_id, {})
            contacts.append(Contact(name=m.owner_name, phone=owner.get("phone", ""), role="proponente"))
            others = await db.applications.find(
                {"match_id": m.id, "status": "accettata", "user_id": {"$ne": user["id"]}}, {"_id": 0}
            ).to_list(10)
            contacts += [Contact(name=o["user_name"], phone=o.get("phone", ""), role="giocatore") for o in others]
        out.append(MyApplication(application=to_app(a), match=m, contacts=contacts))
    return out


@router.get("/me/today", response_model=list[Match])
async def my_today(user: dict = Depends(current_user)):
    """Matches happening today (Europe/Rome) where the user is proponent or accepted player."""
    today = today_iso("Europe/Rome")
    accepted_ids = [
        a["match_id"]
        for a in await db.applications.find({"user_id": user["id"], "status": "accettata"}, {"match_id": 1}).to_list(500)
    ]
    docs = (
        await db.matches.find(
            {
                "date": today,
                "status": {"$ne": "annullata"},
                "$or": [{"owner_id": user["id"]}, {"id": {"$in": accepted_ids}}],
            },
            {"_id": 0},
        )
        .sort("time", 1)
        .to_list(50)
    )
    return await build_matches(docs, user["id"])


@router.get("/me/summary", response_model=Summary)
async def summary(user: dict = Depends(current_user)):
    my_ids = [d["id"] for d in await db.matches.find({"owner_id": user["id"], "status": "aperta"}, {"id": 1}).to_list(500)]
    pending = await db.applications.count_documents({"match_id": {"$in": my_ids}, "status": "in_attesa"})
    accepted = await db.applications.count_documents({"user_id": user["id"], "status": "accettata"})
    return Summary(pending_reviews=pending, accepted_applications=accepted)
