"use client";

import { ChatView } from "@/components/chat/ChatView";

export default function CreatorChatPage() {
  // Fixed height so the page itself never scrolls — only the message list inside ChatView does.
  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-7rem)]">
      <h1 className="mb-2 shrink-0 font-heading text-xl font-bold text-text-primary">Chat</h1>
      <div className="min-h-0 flex-1">
        <ChatView variant="creator" />
      </div>
    </div>
  );
}
