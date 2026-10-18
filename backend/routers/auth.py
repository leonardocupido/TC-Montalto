import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from lib.auth import current_user, end_session, hash_password, start_session, verify_password
from lib.db import db
from models.tennis import DemoLoginIn, DemoUser, LoginIn, RegisterIn, User

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


def demo_enabled() -> bool:
    return os.environ.get("DEMO_LOGIN_ENABLED", "false").lower() == "true"


@router.get("/demo-users", response_model=list[DemoUser])
async def demo_users():
    """Seeded demo accounts for 1-tap login; empty when DEMO_LOGIN_ENABLED is off."""
    if not demo_enabled():
        return []
    docs = await db.users.find({"demo": True}, {"_id": 0, "name": 1, "email": 1}).sort("name", 1).to_list(20)
    return [DemoUser(**d) for d in docs]


@router.post("/demo-login", response_model=User)
async def demo_login(body: DemoLoginIn, response: Response):
    if not demo_enabled():
        raise HTTPException(status_code=404, detail="Accesso demo non disponibile")
    doc = await db.users.find_one({"email": body.email.strip().lower(), "demo": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Socio demo non trovato")
    await start_session(response, doc["id"])
    return to_user(doc)


@router.post("/logout")
async def logout(request: Request, response: Response):
    await end_session(request, response)
    return {"ok": True}


@router.get("/me", response_model=User)
async def me(user: dict = Depends(current_user)):
    return to_user(user)
