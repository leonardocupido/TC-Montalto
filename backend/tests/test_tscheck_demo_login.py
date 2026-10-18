"""Criterion: demo-users list + demo-login with unknown email -> 404."""


def test_demo_users_list_has_four(client):
    resp = client.get("/auth/demo-users")
    assert resp.status_code == 200, resp.text
    data = resp.json()
    emails = {u["email"] for u in data}
    assert emails == {
        "marco@club.it",
        "matteo@club.it",
        "giulia@club.it",
        "lorenzo@club.it",
    }, data


def test_demo_login_known_user_succeeds(client):
    resp = client.post("/auth/demo-login", json={"email": "giulia@club.it"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["email"] == "giulia@club.it"


def test_demo_login_unknown_email_404(client):
    resp = client.post(
        "/auth/demo-login", json={"email": "tscheck-nobody-xq1@club.it"}
    )
    assert resp.status_code == 404, resp.text
