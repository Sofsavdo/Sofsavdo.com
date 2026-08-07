"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatMessageView } from "@sofsavdo/types";
import { Button } from "@sofsavdo/ui";
import { appendMessage, useChatSocket, useConversations, useMarkRead, useMessages, useSendMessage } from "@/services/chat";

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

export function ChatView() {
  const qc = useQueryClient();
  const conversationsQuery = useConversations();
  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Default to the first conversation once the list loads. A one-time async initialization (the data
  // arrives after mount), which is exactly the case setState-in-effect exists for — the mobile
  // "back" button still needs real null state, so deriving this instead wouldn't work.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!selectedId && conversations.length > 0) setSelectedId(conversations[0]!.id);
  }, [conversations, selectedId]);

  const messagesQuery = useMessages(selectedId);
  const sendMessage = useSendMessage(selectedId);
  const markRead = useMarkRead();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Live push: append to the open thread's cache (if loaded) and refresh the conversation list so
  // unread dots / last-message previews update everywhere.
  const onSocketMessage = useCallback(
    (m: ChatMessageView) => {
      appendMessage(qc, m.conversationId, m);
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    [qc],
  );
  useChatSocket(onSocketMessage);

  const messages = messagesQuery.data ?? [];

  // Auto-scroll to newest whenever the thread or its message count changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, selectedId]);

  // Mark a conversation read when it's opened and whenever a new message lands while it's open.
  useEffect(() => {
    if (selectedId) markRead.mutate(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, messages.length]);

  async function handleSend() {
    const body = draft.trim();
    if (!body || !selectedId || sendMessage.isPending) return;
    setDraft("");
    try {
      await sendMessage.mutateAsync(body);
    } catch {
      setDraft(body); // restore on failure so the user doesn't lose their text
    }
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-13rem)] min-h-[24rem] overflow-hidden rounded-card border border-border bg-surface">
      {/* Conversation list */}
      <aside
        className={`${selectedId ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-72 md:shrink-0`}
      >
        <div className="border-b border-border px-4 py-3 font-heading text-sm font-semibold text-text-primary">Suhbatlar</div>
        <div className="flex-1 overflow-y-auto">
          {conversationsQuery.isLoading ? (
            <p className="p-4 font-body text-sm text-text-muted">Yuklanmoqda…</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 font-body text-sm text-text-muted">Suhbatlar yo&apos;q.</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition-colors hover:bg-bg ${
                  c.id === selectedId ? "bg-bg" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-body text-sm font-medium text-text-primary">
                    {c.type === "GROUP" ? `👥 ${c.title}` : c.title}
                  </span>
                  {c.hasUnread ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
                </div>
                <span className="truncate font-body text-xs text-text-muted">
                  {c.lastMessage ? c.lastMessage.body : "Xabar yo'q"}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
        {selected ? (
          <>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <button type="button" className="md:hidden" onClick={() => setSelectedId(null)} aria-label="Orqaga">
                ←
              </button>
              <span className="truncate font-heading text-sm font-semibold text-text-primary">
                {selected.type === "GROUP" ? `👥 ${selected.title}` : selected.title}
              </span>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
              {messagesQuery.isLoading ? (
                <p className="font-body text-sm text-text-muted">Yuklanmoqda…</p>
              ) : messages.length === 0 ? (
                <p className="font-body text-sm text-text-muted">Hali xabar yo&apos;q. Birinchi bo&apos;lib yozing.</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
                    {selected.type === "GROUP" && !m.mine ? (
                      <span className="mb-0.5 px-1 font-body text-xs text-text-muted">
                        {m.senderName}
                        {m.senderIsAdmin ? " · Admin" : ""}
                      </span>
                    ) : null}
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 font-body text-sm ${
                        m.mine ? "bg-accent text-white" : "border border-border bg-bg text-text-primary"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <span className={`mt-1 block text-right text-[10px] ${m.mine ? "text-white/70" : "text-text-muted"}`}>
                        {timeLabel(m.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-end gap-2 border-t border-border p-3">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder="Xabar yozing…"
                className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-input border border-border bg-bg px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent"
              />
              <Button onClick={() => void handleSend()} disabled={!draft.trim() || sendMessage.isPending}>
                {sendMessage.isPending ? "…" : "Yuborish"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6">
            <p className="font-body text-sm text-text-muted">Suhbatni tanlang.</p>
          </div>
        )}
      </section>
    </div>
  );
}
