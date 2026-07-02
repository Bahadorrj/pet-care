import pytest

from app.models.chat import Message
from app.models.user import User
from app.services.chat import ChatService, ConversationNotFoundError


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
