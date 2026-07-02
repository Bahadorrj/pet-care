import pytest

from app.models.chat import Message
from app.models.user import User
from app.schemas.chat import PetContext, PetContextBundle
from app.services.chat import (
    ChatService,
    ConversationNotFoundError,
    NothingToRetryError,
)
from app.services.llm import Delta, ProviderError, Usage


async def _make_user(db, email="u@example.com", username="testuser") -> User:
    user = User(email=email, username=username, password_hash="x")
    db.add(user)
    await db.commit()
    return user


async def test_create_and_list_conversations(db):
    user = await _make_user(db)
    c1 = await ChatService.create_conversation(db, user)
    c2 = await ChatService.create_conversation(db, user)
    c2.updated_at = c2.updated_at.replace(year=2030)  # force newest
    await db.commit()
    conversations = await ChatService.list_conversations(db, user)
    assert [c.id for c in conversations] == [c2.id, c1.id]


async def test_get_conversation_enforces_ownership(db):
    owner = await _make_user(db)
    intruder = await _make_user(db, email="i@example.com", username="intruder")
    conv = await ChatService.create_conversation(db, owner)
    with pytest.raises(ConversationNotFoundError):
        await ChatService.get_conversation(db, intruder, conv.id)
    with pytest.raises(ConversationNotFoundError):
        await ChatService.get_conversation(db, owner, "missing-id")


async def test_delete_conversation_removes_messages(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    db.add(Message(conversation_id=conv.id, role="user", content="سلام"))
    await db.commit()
    await ChatService.delete_conversation(db, user, conv.id)
    assert await ChatService.list_conversations(db, user) == []


async def test_list_messages_oldest_first(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    db.add(Message(conversation_id=conv.id, role="user", content="اول"))
    await db.commit()
    db.add(Message(conversation_id=conv.id, role="assistant", content="دوم"))
    await db.commit()
    msgs = await ChatService.list_messages(db, user, conv.id)
    assert [m.content for m in msgs] == ["اول", "دوم"]


BUNDLE = PetContextBundle(
    pets=[PetContext(name="پیشی", species="cat")],
    scope="all",
    todayJalali="۱۴۰۵/۰۴/۱۱",
)


class FakeProvider:
    """Yields scripted events; the string "boom" raises ProviderError there."""

    def __init__(self, events):
        self._events = events
        self.received_messages = None

    async def stream_chat(self, messages):
        self.received_messages = messages
        for ev in self._events:
            if ev == "boom":
                raise ProviderError("boom")
            yield ev


async def _collect(gen):
    return [e async for e in gen]


async def test_send_happy_path_persists_reply_and_title(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    conv, new_title = await ChatService.prepare_send(
        db, user, conv.id, "سلام گربه‌ام غذا نمی‌خوره"
    )
    assert new_title == "سلام گربه‌ام غذا نمی‌خوره"

    provider = FakeProvider([Delta("نگران "), Delta("نباش"), Usage(11, 7)])
    events = await _collect(
        ChatService.generate_events(db, conv, BUNDLE, provider, new_title)
    )
    assert events[0] == {"delta": "نگران "}
    assert events[-1]["done"] is True and events[-1]["title"] == new_title

    msgs = await ChatService.list_messages(db, user, conv.id)
    assert [m.role for m in msgs] == ["user", "assistant"]
    assert msgs[1].content == "نگران نباش"
    assert msgs[1].input_tokens == 11 and msgs[1].output_tokens == 7
    assert msgs[1].interrupted is False
    assert events[-1]["message_id"] == msgs[1].id


async def test_title_only_set_once_and_truncated(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    _, first_title = await ChatService.prepare_send(db, user, conv.id, "و" * 60)
    assert len(first_title) == 50
    _, second_title = await ChatService.prepare_send(db, user, conv.id, "دوم")
    assert second_title is None


async def test_pre_token_failure_persists_nothing_but_user_message(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    conv, _ = await ChatService.prepare_send(db, user, conv.id, "سلام")
    events = await _collect(
        ChatService.generate_events(db, conv, BUNDLE, FakeProvider(["boom"]))
    )
    assert events == [{"error": "provider_error"}]
    msgs = await ChatService.list_messages(db, user, conv.id)
    assert [m.role for m in msgs] == ["user"]


async def test_mid_stream_failure_persists_partial_as_interrupted(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    conv, _ = await ChatService.prepare_send(db, user, conv.id, "سلام")
    events = await _collect(
        ChatService.generate_events(
            db, conv, BUNDLE, FakeProvider([Delta("نصف"), "boom"])
        )
    )
    assert events == [{"delta": "نصف"}, {"error": "provider_error"}]
    msgs = await ChatService.list_messages(db, user, conv.id)
    assert msgs[-1].role == "assistant" and msgs[-1].interrupted is True
    assert msgs[-1].content == "نصف"


async def test_history_window_is_twenty(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    for i in range(24):
        db.add(Message(conversation_id=conv.id, role="user", content=f"m{i}"))
        await db.commit()
    provider = FakeProvider([Delta("ok")])
    await _collect(ChatService.generate_events(db, conv, BUNDLE, provider))
    # system prompt + last 20 history messages
    assert len(provider.received_messages) == 21
    assert provider.received_messages[1]["content"] == "m4"


async def test_retry_after_interruption_deletes_partial(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    conv, _ = await ChatService.prepare_send(db, user, conv.id, "سلام")
    await _collect(
        ChatService.generate_events(
            db, conv, BUNDLE, FakeProvider([Delta("نصف"), "boom"])
        )
    )
    conv = await ChatService.prepare_retry(db, user, conv.id)
    msgs = await ChatService.list_messages(db, user, conv.id)
    assert [m.role for m in msgs] == ["user"]  # partial deleted, ready to regenerate


async def test_retry_rejects_completed_conversation(db):
    user = await _make_user(db)
    conv = await ChatService.create_conversation(db, user)
    conv, _ = await ChatService.prepare_send(db, user, conv.id, "سلام")
    await _collect(
        ChatService.generate_events(db, conv, BUNDLE, FakeProvider([Delta("کامل")]))
    )
    with pytest.raises(NothingToRetryError):
        await ChatService.prepare_retry(db, user, conv.id)
    with pytest.raises(NothingToRetryError):
        empty = await ChatService.create_conversation(db, user)
        await ChatService.prepare_retry(db, user, empty.id)
