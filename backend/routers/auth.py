import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import current_user, end_session, hash_password, start_session, verify_password
from lib.db import db
from models.tennis import LoginIn, ProfileUpdate, RegisterIn, User

router = APIRouter(prefix="/auth", tags=["auth"])


def to_user(doc: dict) -> User:
    return User(**{k: doc.get(k, "") for k in ("id", "name", "email", "phone", "level")})


@router.post("/register", response_model=User)
async def register(body: RegisterIn, response: Response):
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Email non valida")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email già registrata")
    doc = {
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "email": email,
        "phone": body.phone.strip(),
        "level": body.level.strip(),
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc),
    }
    await db.users.insert_one(doc)
    await start_session(response, doc["id"])
    return to_user(doc)


@router.post("/login", response_model=User)
async def login(body: LoginIn, response: Response):
    doc = await db.users.find_one({"email": body.email.strip().lower()})
    if not doc or not verify_password(body.password, doc.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email o password errati")
    await start_session(response, doc["id"])
    return to_user(doc)


@router.post("/logout")
async def logout(request: Request, response: Response):
    await end_session(request, response)
    return {"ok": True}


@router.get("/me", response_model=User)
async def me(user: dict = Depends(current_user)):
    return to_user(user)


@router.patch("/me", response_model=User)
async def update_me(body: ProfileUpdate, user: dict = Depends(current_user)):
    """Member edits own profile; denormalised names/levels on matches, applications and challenges follow."""
    email = body.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Email non valida")
    if email != user["email"] and await db.users.find_one({"email": email, "id": {"$ne": user["id"]}}):
        raise HTTPException(status_code=400, detail="Email già usata da un altro socio")
    name, level, uid = body.name.strip(), body.level.strip(), user["id"]
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Inserisci nome e cognome")
    upd = {"name": name, "email": email, "phone": body.phone.strip(), "level": level}
    await db.users.update_one({"id": uid}, {"$set": upd})
    await db.matches.update_many({"owner_id": uid}, {"$set": {"owner_name": name, "owner_level": level}})
    await db.applications.update_many({"user_id": uid}, {"$set": {"user_name": name, "user_level": level}})
    await db.challenges.update_many({"challenger_id": uid}, {"$set": {"challenger_name": name, "challenger_level": level}})
    await db.challenges.update_many({"challenged_id": uid}, {"$set": {"challenged_name": name}})
    return to_user({**user, **upd})
