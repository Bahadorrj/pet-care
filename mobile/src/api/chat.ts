import { fetch as expoFetch } from "expo/fetch";

import client, { BASE_URL } from "./client";
import { createSseParser } from "../lib/sse";
import { useAuthStore } from "../store/authStore";
import type { PetContextBundle } from "../lib/petContext";

export interface ConversationSummary {
  id: string;
  title: string | null;
  updated_at: string;
}

export interface ApiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  interrupted: boolean;
  created_at: string;
}

export type ChatStreamEvent =
  | { delta: string }
  | { done: true; message_id: string; title: string | null }
  | { error: string };

export async function listConversations(): Promise<ConversationSummary[]> {
  return (await client.get("/chat/conversations")).data;
}

export async function createConversation(): Promise<ConversationSummary> {
  return (await client.post("/chat/conversations")).data;
}

export async function deleteConversation(id: string): Promise<void> {
  await client.delete(`/chat/conversations/${id}`);
}

export async function listMessages(id: string): Promise<ApiMessage[]> {
  return (await client.get(`/chat/conversations/${id}/messages`)).data;
}

/**
 * POST + read the SSE response body. Uses expo/fetch instead of the shared
 * axios client because axios cannot stream response bodies in React Native.
 * Throws i18n error keys, matching the store convention.
 */
async function streamChat(
  path: string,
  body: object,
  onEvent: (evt: ChatStreamEvent) => void,
): Promise<void> {
  const token = useAuthStore.getState().token;
  const res = await expoFetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("chat.error.quota");
  if (!res.ok || !res.body) throw new Error("chat.error.network");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser((evt) => onEvent(evt as ChatStreamEvent));
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(decoder.decode(value, { stream: true }));
  }
}

export function sendMessage(
  conversationId: string,
  content: string,
  context: PetContextBundle,
  onEvent: (evt: ChatStreamEvent) => void,
): Promise<void> {
  return streamChat(
    `/chat/conversations/${conversationId}/messages`,
    { content, context },
    onEvent,
  );
}

export function retryMessage(
  conversationId: string,
  context: PetContextBundle,
  onEvent: (evt: ChatStreamEvent) => void,
): Promise<void> {
  return streamChat(
    `/chat/conversations/${conversationId}/retry`,
    { context },
    onEvent,
  );
}
