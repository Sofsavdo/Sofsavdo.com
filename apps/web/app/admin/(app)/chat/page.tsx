"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChatView } from "@/components/chat/ChatView";
import { useOpenCreatorDirect } from "@/services/chat";

function AdminChatInner() {
  const params = useSearchParams();
  const creatorId = params.get("creatorId");
  const openDirect = useOpenCreatorDirect();
  const [initialId, setInitialId] = useState<string | null>(null);

  // Arriving from the "message this creator" action on the creators list — open (or create) that
  // creator's DM thread and select it.
  useEffect(() => {
    if (!creatorId) return;
    openDirect
      .mutateAsync(creatorId)
      .then((r) => setInitialId(r.conversationId))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorId]);

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-7rem)]">
      <h1 className="mb-2 shrink-0 font-heading text-xl font-bold text-text-primary">Chat</h1>
      <div className="min-h-0 flex-1">
        <ChatView variant="admin" initialConversationId={initialId} />
      </div>
    </div>
  );
}

export default function AdminChatPage() {
  // useSearchParams needs a Suspense boundary under the app router.
  return (
    <Suspense fallback={null}>
      <AdminChatInner />
    </Suspense>
  );
}
