"use client";

import { ChatView } from "@/components/chat/ChatView";

export default function CreatorChatPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Chat</h1>
        <p className="font-body text-sm text-text-secondary">
          Admin bilan shaxsiy yozishuv va umumiy guruh — savollaringizni bevosita yozing.
        </p>
      </div>
      <ChatView />
    </div>
  );
}
