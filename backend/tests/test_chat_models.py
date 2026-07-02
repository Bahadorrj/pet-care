from sqlalchemy import select

from app.models.chat import Conversation, Message
from app.models.user import User


async def _make_user(db) -> User:
    user = User(email="u@example.com", username="testuser", password_hash="x")
    db.add(user)
    await db.commit()
    return user


async def test_conversation_defaults(db):
    user = await _make_user(db)
    conv = Conversation(user_id=user.id)
    db.add(conv)
    await db.commit()
    assert len(conv.id) == 36
    assert conv.title is None
    assert conv.created_at is not None


async def test_delete_conversation_cascades_messages(db):
    user = await _make_user(db)
    conv = Conversation(user_id=user.id)
    conv.messages.append(Message(role="user", content="سلام"))
    conv.messages.append(Message(role="assistant", content="سلام!"))
    db.add(conv)
    await db.commit()

    await db.delete(conv)
    await db.commit()

    result = await db.execute(select(Message))
    assert result.scalars().all() == []


async def test_message_defaults(db):
    user = await _make_user(db)
    conv = Conversation(user_id=user.id)
    db.add(conv)
    await db.commit()
    msg = Message(conversation_id=conv.id, role="user", content="hi")
    db.add(msg)
    await db.commit()
    assert msg.interrupted is False
    assert msg.input_tokens is None and msg.output_tokens is None
