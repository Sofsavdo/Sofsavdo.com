"use client";

import { ChatView } from "@/components/chat/ChatView";

export default function AdminChatPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Chat</h1>
        <p className="font-body text-sm text-text-secondary">
          Creatorlar bilan shaxsiy yozishuvlar (inbox) va umumiy guruh.
        </p>
      </div>
      <ChatView />
    </div>
  );
}
