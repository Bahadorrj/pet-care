# ADR-0019: AI chat via backend LLM proxy; client-supplied pet context; server-side history

## Status
Accepted

## Date
2026-07-02

## Context
The AI chat feature (spec 13) needs an LLM, knowledge of the user's pets/tasks
(which live only in on-device SQLite — ADR-0015/0016), and chat history. Major
LLM providers block Iranian IPs, so devices cannot call them directly, and an
API key must never ship in the app.

## Decision
1. **All LLM traffic is server-mediated.** The backend owns the provider API
   key and the system prompt. A minimal `LLMProvider` seam (messages in → async
   token stream out) has one implementation, `OpenRouterProvider`; the model is
   a config value (`LLM_MODEL`, default `google/gemini-2.5-flash`).
2. **Pet context is client-supplied per message.** The app serializes pet
   profiles + compact task summaries into each chat request; the server injects
   them into the prompt inside data-only delimiters and never stores them. No
   pet/task sync layer is built.
3. **Chat history is server-side** (`conversations` + `messages` tables). Chat
   is account-gated (a "personal feature" per ADR-0011) and inherently online,
   so local-first does not apply to this domain. Token usage is recorded per
   assistant message from day one; a no-op `check_quota` seam is the future
   subscription enforcement point.

## Alternatives Considered
- **Device → provider directly**: key in the app + geo-blocked. Rejected.
- **Pet/task sync first**: a whole feature (conflicts, multi-device) that
  reverses local-first for no v1 benefit. Rejected.
- **Local chat history**: dies with the device, duplicates what the server
  already sees, and complicates context assembly. Rejected.

## Consequences
- The backend becomes a hard runtime dependency for chat (only) — the rest of
  the app stays offline-first.
- Pet data leaves the device for the first time; the UI discloses this once.
- Swapping model/provider is config + one class; routers and mobile never know.

## Guardrails
**Always**
- Keep the provider API key and system prompt server-side only.
- Record input/output tokens on every assistant message.
- Wrap client-supplied context in data-only delimiters in the prompt.
**Never**
- Never store pet-context bundles server-side.
- Never let clients set system/assistant roles.
- Never log message content or pet data at INFO.
