import json
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.chat import (
    ConversationResponse,
    MessageResponse,
    RetryRequest,
    SendMessageRequest,
)
from app.services.chat import (
    ChatService,
    ConversationNotFoundError,
    NothingToRetryError,
    QuotaExceededError,
)
from app.services.llm import LLMProvider, OpenRouterProvider

router = APIRouter(prefix="/chat", tags=["chat"])


def get_provider() -> LLMProvider:
    """Dependency seam so tests inject a FakeProvider."""
    return OpenRouterProvider()


async def _sse(events: AsyncIterator[dict]) -> AsyncIterator[str]:
    async for event in events:
        yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    db: AsyncSession = Depends(get_db), user: User = Depends(current_user)
):
    return await ChatService.list_conversations(db, user)


@router.post("/conversations", status_code=201, response_model=ConversationResponse)
async def create_conversation(
    db: AsyncSession = Depends(get_db), user: User = Depends(current_user)
):
    return await ChatService.create_conversation(db, user)


@router.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    try:
        await ChatService.delete_conversation(db, user, conversation_id)
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="not_found")


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
async def list_messages(
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
):
    try:
        return await ChatService.list_messages(db, user, conversation_id)
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="not_found")


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
    provider: LLMProvider = Depends(get_provider),
):
    try:
        conv, new_title = await ChatService.prepare_send(
            db, user, conversation_id, body.content
        )
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="not_found")
    except QuotaExceededError:
        raise HTTPException(status_code=429, detail="quota_exceeded")
    events = ChatService.generate_events(db, conv, body.context, provider, new_title)
    return StreamingResponse(_sse(events), media_type="text/event-stream")


@router.post("/conversations/{conversation_id}/retry")
async def retry_reply(
    conversation_id: str,
    body: RetryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_user),
    provider: LLMProvider = Depends(get_provider),
):
    try:
        conv = await ChatService.prepare_retry(db, user, conversation_id)
    except ConversationNotFoundError:
        raise HTTPException(status_code=404, detail="not_found")
    except QuotaExceededError:
        raise HTTPException(status_code=429, detail="quota_exceeded")
    except NothingToRetryError:
        raise HTTPException(status_code=409, detail="nothing_to_retry")
    events = ChatService.generate_events(db, conv, body.context, provider)
    return StreamingResponse(_sse(events), media_type="text/event-stream")
