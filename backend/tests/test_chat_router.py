import json

from app.main import app
from app.routers.chat import get_provider
from app.services.llm import Delta, Usage
from tests.test_chat_service import BUNDLE, FakeProvider

CTX = json.loads(BUNDLE.model_dump_json())


async def _auth_headers(client, email="u@example.com", username="testuser"):
    res = await client.post(
        "/auth/register",
        json={"email": email, "password": "password123", "username": username},
    )
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


async def _stream_events(client, method, url, payload, headers):
    body = ""
    async with client.stream(method, url, json=payload, headers=headers) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        async for chunk in resp.aiter_text():
            body += chunk
    return [
        json.loads(block[6:])
        for block in body.split("\n\n")
        if block.startswith("data: ")
    ]


async def test_conversation_crud_roundtrip(client):
    headers = await _auth_headers(client)
    created = (await client.post("/chat/conversations", headers=headers)).json()
    assert created["title"] is None

    listed = (await client.get("/chat/conversations", headers=headers)).json()
    assert [c["id"] for c in listed] == [created["id"]]

    res = await client.delete(f"/chat/conversations/{created['id']}", headers=headers)
    assert res.status_code == 204
    assert (await client.get("/chat/conversations", headers=headers)).json() == []


async def test_routes_require_auth(client):
    assert (
        await client.get("/chat/conversations")
    ).status_code == 401  # no bearer token


async def test_ownership_is_uniform_404(client):
    owner = await _auth_headers(client)
    conv = (await client.post("/chat/conversations", headers=owner)).json()
    intruder = await _auth_headers(client, email="i@example.com", username="intruder")
    res = await client.get(
        f"/chat/conversations/{conv['id']}/messages", headers=intruder
    )
    assert res.status_code == 404 and res.json()["detail"] == "not_found"


async def test_send_message_streams_and_persists(client):
    headers = await _auth_headers(client)
    conv = (await client.post("/chat/conversations", headers=headers)).json()
    app.dependency_overrides[get_provider] = lambda: FakeProvider(
        [Delta("سلا"), Delta("م"), Usage(5, 2)]
    )
    events = await _stream_events(
        client,
        "POST",
        f"/chat/conversations/{conv['id']}/messages",
        {"content": "سلام", "context": CTX},
        headers,
    )
    assert events[0] == {"delta": "سلا"}
    assert events[-1]["done"] is True and events[-1]["title"] == "سلام"

    msgs = (
        await client.get(f"/chat/conversations/{conv['id']}/messages", headers=headers)
    ).json()
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[1]["content"] == "سلام"


async def test_retry_conflict_when_nothing_to_retry(client):
    headers = await _auth_headers(client)
    conv = (await client.post("/chat/conversations", headers=headers)).json()
    res = await client.post(
        f"/chat/conversations/{conv['id']}/retry",
        json={"context": CTX},
        headers=headers,
    )
    assert res.status_code == 409 and res.json()["detail"] == "nothing_to_retry"


async def test_oversized_content_is_422(client):
    headers = await _auth_headers(client)
    conv = (await client.post("/chat/conversations", headers=headers)).json()
    res = await client.post(
        f"/chat/conversations/{conv['id']}/messages",
        json={"content": "x" * 4001, "context": CTX},
        headers=headers,
    )
    assert res.status_code == 422
