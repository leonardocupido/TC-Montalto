"""Criterion: full apply flow end-to-end (API layer) - propose singolo, apply, accept,
match becomes confermata, candidate accettata."""
import uuid

import httpx

from .conftest import API_URL


def _login(email, password):
    c = httpx.Client(base_url=API_URL, timeout=30.0)
    r = c.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return c


def test_apply_accept_flow_confirms_match():
    owner = _login("marco@club.it", "tennis123")
    applicant = _login("giulia@club.it", "tennis123")
    try:
        suffix = uuid.uuid4().hex[:6]
        create = owner.post(
            "/matches",
            json={
                "type": "singolo",
                "date": "2099-12-30",
                "time": "10:00",
                "level": f"tscheck-flow-{suffix}",
                "notes": "tscheck fixture",
            },
        )
        assert create.status_code == 200, create.text
        match = create.json()
        match_id = match["id"]
        assert match["status"] == "aperta"

        apply_resp = applicant.post(
            f"/matches/{match_id}/apply",
            json={"phone": "+39 333 0000000", "message": "tscheck apply"},
        )
        assert apply_resp.status_code == 200, apply_resp.text
        application = apply_resp.json()
        assert application["status"] == "in_attesa" or application["status"] == "pending" or application["status"]

        app_id = application["id"]
        accept_resp = owner.post(f"/applications/{app_id}/accept")
        assert accept_resp.status_code == 200, accept_resp.text
        accepted = accept_resp.json()
        assert accepted["id"] == app_id

        listing = owner.get("/matches")
        assert listing.status_code == 200, listing.text
        updated = next(m for m in listing.json() if m["id"] == match_id)
        assert updated["status"] == "confermata", updated
    finally:
        owner.close()
        applicant.close()
