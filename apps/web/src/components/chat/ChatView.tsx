"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ChatConversationView, ChatMessageView } from "@sofsavdo/types";
import { Button } from "@sofsavdo/ui";
import { appendMessage, useChatSocket, useConversations, useMarkRead, useMessages, useSendMessage } from "@/services/chat";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function convLabel(c: ChatConversationView): string {
  if (c.type === "GROUP") return `👥 ${c.title}`;
  return c.title;
}

export function ChatView({ variant, initialConversationId }: { variant: "creator" | "admin"; initialConversationId?: string | null }) {
  const qc = useQueryClient();
  const conversationsQuery = useConversations();
  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(initialConversationId ?? null);

  // Follow an incoming deep-link (admin "message this creator") once its conversation appears.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialConversationId) setSelectedId(initialConversationId);
  }, [initialConversationId]);

  // Default selection: a creator starts on their Admin DM; an admin starts on nothing (inbox view).
  useEffect(() => {
    if (selectedId || conversations.length === 0) return;
    if (variant === "creator") {
      const direct = conversations.find((c) => c.type === "DIRECT") ?? conversations[0]!;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedId(direct.id);
    }
  }, [conversations, selectedId, variant]);

  const messagesQuery = useMessages(selectedId);
  const sendMessage = useSendMessage(selectedId);
  const markRead = useMarkRead();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const onSocketMessage = useCallback(
    (m: ChatMessageView) => {
      appendMessage(qc, m.conversationId, m);
      qc.invalidateQueries({ queryKey: ["chat", "conversations"] });
    },
    [qc],
  );
  useChatSocket(onSocketMessage);

  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, selectedId]);

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
      setDraft(body);
    }
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Creator layout: two always-visible tabs (Admin DM + Group) over the thread — nothing hidden, so
  // the group is never lost behind a collapsed sidebar on mobile.
  const creatorTabs = variant === "creator";

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-card border border-border bg-surface">
      {creatorTabs ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 gap-1 border-b border-border p-2">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`relative flex-1 rounded-input px-3 py-2 font-body text-sm font-medium transition-colors ${
                  c.id === selectedId ? "bg-accent/10 text-accent" : "text-text-secondary hover:bg-bg"
                }`}
              >
                {c.type === "GROUP" ? "👥 Umumiy guruh" : "Admin bilan"}
                {c.hasUnread ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent" /> : null}
              </button>
            ))}
          </div>
          <Thread
            selected={selected}
            messages={messages}
            loading={messagesQuery.isLoading}
            scrollRef={scrollRef}
            draft={draft}
            setDraft={setDraft}
            onSend={handleSend}
            sending={sendMessage.isPending}
            showBack={false}
            onBack={() => undefined}
          />
        </div>
      ) : (
        <>
          {/* Admin inbox */}
          <aside className={`${selectedId ? "hidden md:flex" : "flex"} w-full flex-col border-r border-border md:w-72 md:shrink-0`}>
            <div className="shrink-0 border-b border-border px-4 py-3 font-heading text-sm font-semibold text-text-primary">
              Suhbatlar
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
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
                      <span className="truncate font-body text-sm font-medium text-text-primary">{convLabel(c)}</span>
                      {c.hasUnread ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" /> : null}
                    </div>
                    <span className="truncate font-body text-xs text-text-muted">{c.lastMessage ? c.lastMessage.body : "Xabar yo'q"}</span>
                  </button>
                ))
              )}
            </div>
          </aside>
          <section className={`${selectedId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col`}>
            <Thread
              selected={selected}
              messages={messages}
              loading={messagesQuery.isLoading}
              scrollRef={scrollRef}
              draft={draft}
              setDraft={setDraft}
              onSend={handleSend}
              sending={sendMessage.isPending}
              showBack
              onBack={() => setSelectedId(null)}
            />
          </section>
        </>
      )}
    </div>
  );
}

function Thread({
  selected,
  messages,
  loading,
  scrollRef,
  draft,
  setDraft,
  onSend,
  sending,
  showBack,
  onBack,
}: {
  selected: ChatConversationView | null;
  messages: ChatMessageView[];
  loading: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  showBack: boolean;
  onBack: () => void;
}) {
  if (!selected) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="font-body text-sm text-text-muted">Suhbatni tanlang.</p>
      </div>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
        {showBack ? (
          <button type="button" className="md:hidden" onClick={onBack} aria-label="Orqaga">
            ←
          </button>
        ) : null}
        <span className="truncate font-heading text-sm font-semibold text-text-primary">{convLabel(selected)}</span>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
        {loading ? (
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

      <div className="flex shrink-0 items-end gap-2 border-t border-border p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          rows={1}
          placeholder="Xabar yozing…"
          className="max-h-32 min-h-[2.5rem] flex-1 resize-none rounded-input border border-border bg-bg px-3 py-2 font-body text-sm text-text-primary outline-none focus:border-accent"
        />
        <Button onClick={onSend} disabled={!draft.trim() || sending}>
          {sending ? "…" : "Yuborish"}
        </Button>
      </div>
    </div>
  );
}
