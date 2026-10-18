"""Criterion: password verification refactor - login correct/wrong, register+login round trip."""
import uuid


def test_login_correct_password_200(client):
    resp = client.post(
        "/auth/login", json={"email": "marco@club.it", "password": "tennis123"}
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["email"] == "marco@club.it"


def test_login_wrong_password_401(client):
    resp = client.post(
        "/auth/login", json={"email": "marco@club.it", "password": "wrongpass"}
    )
    assert resp.status_code == 401, resp.text


def test_register_then_login_roundtrip(client):
    suffix = uuid.uuid4().hex[:8]
    email = f"tscheck-reg-{suffix}@club.it"
    password = "secret123"

    reg = client.post(
        "/auth/register",
        json={"name": "Tscheck User", "email": email, "password": password},
    )
    assert reg.status_code == 200, reg.text
    assert reg.json()["email"] == email

    client.post("/auth/logout")

    login = client.post("/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200, login.text
    assert login.json()["email"] == email

    bad_login = client.post(
        "/auth/login", json={"email": email, "password": "wrongpass"}
    )
    assert bad_login.status_code == 401, bad_login.text
