"""Chat domain service: conversations, messages, and (Task 7) the send pipeline."""

import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import Conversation, Message
from app.models.user import User

HISTORY_WINDOW = 20
TITLE_MAX = 50


class ConversationNotFoundError(Exception):
    """Missing conversation OR not owned by the caller — uniform, no leak."""


class QuotaExceededError(Exception):
    """Raised by check_quota once subscription enforcement exists."""


class NothingToRetryError(Exception):
    """Retry called on a conversation whose last message isn't retryable."""


def _utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


class ChatService:
    @staticmethod
    def check_quota(user: User) -> None:
        # ponytail: no-op quota seam — future subscription enforcement raises
        # QuotaExceededError here; the 429 path is already wired end to end.
        return

    @staticmethod
    async def create_conversation(db: AsyncSession, user: User) -> Conversation:
        conv = Conversation(user_id=user.id)
        db.add(conv)
        await db.commit()
        await db.refresh(conv)
        return conv

    @staticmethod
    async def list_conversations(db: AsyncSession, user: User) -> list[Conversation]:
        result = await db.execute(
            select(Conversation)
            .where(Conversation.user_id == user.id)
            .order_by(Conversation.updated_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_conversation(
        db: AsyncSession, user: User, conversation_id: str
    ) -> Conversation:
        conv = await db.get(Conversation, conversation_id)
        if conv is None or conv.user_id != user.id:
            raise ConversationNotFoundError(conversation_id)
        return conv

    @staticmethod
    async def delete_conversation(
        db: AsyncSession, user: User, conversation_id: str
    ) -> None:
        conv = await ChatService.get_conversation(db, user, conversation_id)
        await db.delete(conv)
        await db.commit()

    @staticmethod
    async def list_messages(
        db: AsyncSession, user: User, conversation_id: str
    ) -> list[Message]:
        await ChatService.get_conversation(db, user, conversation_id)
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc(), Message.id.asc())
        )
        return list(result.scalars().all())
