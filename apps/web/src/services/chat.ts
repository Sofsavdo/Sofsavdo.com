"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChatConversationView, ChatMessageView } from "@sofsavdo/types";
import { apiRequest, getAccessToken } from "@/lib/api/http-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

// REST is the source of truth; the socket (below) is a live-push enhancement. The 20s refetch is the
// floor that keeps things eventually-consistent even if the socket is down.
export function useConversations() {
  return useQuery({
    queryKey: ["chat", "conversations"],
    queryFn: () => apiRequest<ChatConversationView[]>("/chat/conversations"),
    refetchInterval: 20_000,
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["chat", "messages", conversationId],
    queryFn: () => apiRequest<ChatMessageView[]>(`/chat/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
  });
}

export function useSendMessage(conversationId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      apiRequest<ChatMessageView>(`/chat/conversations/${conversationId}/messages`, { method: "POST", body: { body } }),
    onSuccess: (message) => {
      appendMessage(qc, message.conversationId, message);
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (conversationId: string) => apiRequest(`/chat/conversations/${conversationId}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat", "conversations"] }),
  });
}

// Dedupe-on-id append: a message we sent arrives twice (once from the POST response, once echoed by
// the socket), and a socket-pushed message from the other side has the sender's `mine=true` baked in
// — so anything newly seen over the socket is forced to mine=false here.
export function appendMessage(qc: ReturnType<typeof useQueryClient>, conversationId: string, message: ChatMessageView) {
  qc.setQueryData<ChatMessageView[]>(["chat", "messages", conversationId], (old) => {
    if (!old) return old;
    if (old.some((m) => m.id === message.id)) return old;
    return [...old, message];
  });
}

// One socket connection per mounted chat view. The handler is kept in a ref so the socket isn't torn
// down and rebuilt on every render. If there's no token yet (pre-refresh), we simply don't connect —
// the polling fallback above still delivers messages.
export function useChatSocket(onMessage: (m: ChatMessageView) => void) {
  const handlerRef = useRef(onMessage);
  useEffect(() => {
    handlerRef.current = onMessage;
  });

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    // Default transports (HTTP long-poll that upgrades to WebSocket) rather than websocket-only, so a
    // proxy that stalls the raw WS upgrade still connects and then upgrades — the API runs as a
    // single instance so socket.io polling needs no sticky-session handling.
    const socket: Socket = io(`${API_URL}/chat`, {
      auth: { token },
      reconnection: true,
    });
    socket.on("chat:message", (m: ChatMessageView) => handlerRef.current({ ...m, mine: false }));
    return () => {
      socket.off("chat:message");
      socket.disconnect();
    };
  }, []);
}
