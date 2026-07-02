"""Chat domain service: conversations, messages, and (Task 7) the send pipeline."""

import datetime
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import Conversation, Message
from app.models.user import User
from app.schemas.chat import PetContextBundle
from app.services.llm import Delta, LLMProvider, ProviderError, Usage
from app.services.prompt import build_messages

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

    @staticmethod
    async def prepare_send(
        db: AsyncSession, user: User, conversation_id: str, content: str
    ) -> tuple[Conversation, str | None]:
        """Ownership + quota checks, persist the user message, derive title."""
        conv = await ChatService.get_conversation(db, user, conversation_id)
        ChatService.check_quota(user)
        db.add(Message(conversation_id=conv.id, role="user", content=content))
        new_title = None
        if conv.title is None:
            new_title = content[:TITLE_MAX]
            conv.title = new_title
        conv.updated_at = _utcnow()
        await db.commit()
        return conv, new_title

    @staticmethod
    async def prepare_retry(
        db: AsyncSession, user: User, conversation_id: str
    ) -> Conversation:
        """Valid when the last message is a user msg (pre-token failure) or an
        interrupted assistant msg (mid-stream failure; the partial is deleted)."""
        conv = await ChatService.get_conversation(db, user, conversation_id)
        ChatService.check_quota(user)
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()
        if last is None:
            raise NothingToRetryError(conversation_id)
        if last.role == "assistant":
            if not last.interrupted:
                raise NothingToRetryError(conversation_id)
            await db.delete(last)
            await db.commit()
        return conv

    @staticmethod
    async def _window(db: AsyncSession, conversation_id: str) -> list[Message]:
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc(), Message.id.desc())
            .limit(HISTORY_WINDOW)
        )
        return list(reversed(result.scalars().all()))

    @staticmethod
    async def generate_events(
        db: AsyncSession,
        conversation: Conversation,
        context: PetContextBundle,
        provider: LLMProvider,
        new_title: str | None = None,
    ) -> AsyncIterator[dict]:
        """Stream provider deltas as event dicts; persist the reply at the end.

        Mid-stream failure persists the partial text as interrupted; pre-token
        failure persists nothing (the user message is already saved).
        """
        history = await ChatService._window(db, conversation.id)
        provider_messages = build_messages(context, history)
        parts: list[str] = []
        usage: Usage | None = None
        try:
            async for event in provider.stream_chat(provider_messages):
                if isinstance(event, Delta):
                    parts.append(event.text)
                    yield {"delta": event.text}
                elif isinstance(event, Usage):
                    usage = event
        except ProviderError:
            if parts:
                db.add(
                    Message(
                        conversation_id=conversation.id,
                        role="assistant",
                        content="".join(parts),
                        interrupted=True,
                    )
                )
                await db.commit()
            yield {"error": "provider_error"}
            return
        message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content="".join(parts),
            input_tokens=usage.input_tokens if usage else None,
            output_tokens=usage.output_tokens if usage else None,
        )
        conversation.updated_at = _utcnow()
        db.add(message)
        await db.commit()
        yield {"done": True, "message_id": message.id, "title": new_title}
