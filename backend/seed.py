"""Idempotent demo seed: 4 demo soci (password tennis123), no matches. Run: python seed.py"""
import asyncio
import uuid
from datetime import datetime, timezone

from lib.auth import hash_password
from lib.db import db, ensure_indexes

USERS = [
    ("marco@club.it", "Marco Rossi", "+39 338 1234567", "Intermedio (4.2)"),
    ("matteo@club.it", "Matteo Bianchi", "+39 340 7654321", "Avanzato (3.4)"),
    ("giulia@club.it", "Giulia Ferrari", "+39 339 9876543", "Principiante (NC)"),
    ("lorenzo@club.it", "Lorenzo Conti", "+39 347 5551234", "Intermedio (4.1)"),
]


async def main():
    await ensure_indexes()
    ids = {}
    for email, name, phone, level in USERS:
        existing = await db.users.find_one({"email": email})
        if existing:
            await db.users.update_one({"email": email}, {"$set": {"demo": True}})
            ids[email] = existing
            continue
        doc = {
            "id": str(uuid.uuid4()), "name": name, "email": email, "phone": phone, "level": level,
            "password_hash": hash_password("tennis123"), "created_at": datetime.now(timezone.utc),
            "demo": True,
        }
        await db.users.insert_one(doc)
        ids[email] = doc

    # No demo matches: the board starts empty and fills with real members' proposals.
    print("seed complete")


if __name__ == "__main__":
    asyncio.run(main())
