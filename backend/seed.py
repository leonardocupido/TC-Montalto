"""Idempotent demo seed: 4 soci (password tennis123) + a few matches. Run: python seed.py"""
import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone

from lib.auth import hash_password
from lib.db import db, ensure_indexes
from lib.dates import today_iso

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
            ids[email] = existing
            continue
        doc = {
            "id": str(uuid.uuid4()), "name": name, "email": email, "phone": phone, "level": level,
            "password_hash": hash_password("tennis123"), "created_at": datetime.now(timezone.utc),
        }
        await db.users.insert_one(doc)
        ids[email] = doc

    if await db.matches.count_documents({"seed": True}) > 0:
        print("seed matches already present")
        return
    today = date.fromisoformat(today_iso("Europe/Rome"))

    def d(n: int) -> str:
        return (today + timedelta(days=n)).isoformat()

    def match(owner, typ, day, time, level, notes, status="aperta"):
        u = ids[owner]
        return {
            "id": str(uuid.uuid4()), "owner_id": u["id"], "owner_name": u["name"], "owner_level": u["level"],
            "type": typ, "date": day, "time": time, "level": level, "notes": notes, "status": status,
            "created_at": datetime.now(timezone.utc), "seed": True,
        }

    m1 = match("marco@club.it", "singolo", d(1), "18:30", "Intermedio 4.x", "Campo 2 terra rossa, porto io le palline nuove")
    m2 = match("matteo@club.it", "doppio", d(2), "10:00", "Avanzato", "Cerco un mancino per il doppio")
    m3 = match("lorenzo@club.it", "singolo", d(3), "19:00", "Aperto a tutti", "Campo già prenotato", status="confermata")
    m4 = match("giulia@club.it", "doppio", d(4), "17:00", "Principianti", "Doppio misto tranquillo")
    await db.matches.insert_many([m1, m2, m3, m4])

    def app(m, email, status, msg):
        u = ids[email]
        return {
            "id": str(uuid.uuid4()), "match_id": m["id"], "user_id": u["id"], "user_name": u["name"],
            "user_level": u["level"], "phone": u["phone"], "message": msg, "status": status,
            "created_at": datetime.now(timezone.utc),
        }

    await db.applications.insert_many([
        app(m1, "lorenzo@club.it", "in_attesa", "Ci sono! Arrivo 10 minuti prima."),
        app(m2, "marco@club.it", "accettata", "Gioco volentieri a destra."),
        app(m3, "giulia@club.it", "accettata", "Perfetto, a giovedì!"),
    ])
    print("seed complete")


if __name__ == "__main__":
    asyncio.run(main())
