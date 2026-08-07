import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RolesService } from "../roles/roles.service";
import { DomainException } from "../common/errors/domain-error";

// The two sides of every chat: a creator (identified by their CreatorProfile) or an admin (any staff
// user, i.e. one holding at least one role). Buyers hold neither and cannot use chat.
export interface ChatIdentity {
  userId: string;
  creatorId: string | null;
  isAdmin: boolean;
}

const GROUP_TITLE = "Umumiy guruh";
const MESSAGE_PAGE = 40;

export interface ChatConversationView {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string;
  lastMessage: { body: string; createdAt: Date; senderIsAdmin: boolean } | null;
  hasUnread: boolean;
}

export interface ChatMessageView {
  id: string;
  conversationId: string;
  senderId: string;
  senderIsAdmin: boolean;
  senderName: string | null;
  body: string;
  createdAt: Date;
  mine: boolean;
}

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private roles: RolesService,
  ) {}

  // Builds a chat identity from a userId — used by the WebSocket gateway, which only has the `sub`
  // claim from a verified token. Mirrors JwtStrategy: an inactive/missing user resolves to null.
  // isAdmin = holds at least one staff role; a creator is identified by their CreatorProfile.
  async resolveIdentity(userId: string): Promise<ChatIdentity | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { creatorProfile: { select: { id: true } } } });
    if (!user || user.status !== "ACTIVE") return null;
    const { roleKeys } = await this.roles.getRoleKeysAndPermissionsForUser(userId);
    const creatorId = user.creatorProfile?.id ?? null;
    const isAdmin = roleKeys.length > 0;
    // A buyer (neither a creator nor staff) has no place in chat.
    if (!creatorId && !isAdmin) return null;
    return { userId, creatorId, isAdmin };
  }

  // ---- Provisioning (idempotent find-or-create) ----

  async ensureGlobalGroup(): Promise<string> {
    const existing = await this.prisma.chatConversation.findFirst({ where: { type: "GROUP" } });
    if (existing) return existing.id;
    // A race between two first-callers can create two groups; the type index isn't unique (a GROUP
    // has no natural unique key). Re-read after create and collapse to the earliest so the whole
    // platform converges on one group. Cheap because it only ever runs on the very first messages.
    const created = await this.prisma.chatConversation.create({ data: { type: "GROUP", title: GROUP_TITLE } });
    const earliest = await this.prisma.chatConversation.findFirst({ where: { type: "GROUP" }, orderBy: { createdAt: "asc" } });
    return earliest?.id ?? created.id;
  }

  async ensureCreatorDirect(creatorUserId: string): Promise<string> {
    const existing = await this.prisma.chatConversation.findUnique({ where: { creatorUserId } });
    if (existing) return existing.id;
    try {
      const created = await this.prisma.chatConversation.create({
        data: { type: "DIRECT", creatorUserId, participants: { create: { userId: creatorUserId } } },
      });
      return created.id;
    } catch (err) {
      // Lost a race with a concurrent first-open — the unique creatorUserId guarantees the other
      // write's row is the canonical one, so just return it.
      if (err instanceof Object && "code" in err && (err as { code?: string }).code === "P2002") {
        const row = await this.prisma.chatConversation.findUniqueOrThrow({ where: { creatorUserId } });
        return row.id;
      }
      throw err;
    }
  }

  // Lazily records a user as a group participant the first time they touch it, so their read cursor
  // has somewhere to live without pre-seeding a row for every creator on the platform.
  private async ensureGroupParticipant(conversationId: string, userId: string): Promise<void> {
    await this.prisma.chatParticipant.upsert({
      where: { conversationId_userId: { conversationId, userId } },
      create: { conversationId, userId },
      update: {},
    });
  }

  // ---- Authorization ----

  // Returns the conversation if `who` may read/post in it, else throws. DIRECT: the owning creator or
  // any admin. GROUP: anyone (creator or admin).
  private async authorizeConversation(conversationId: string, who: ChatIdentity) {
    const convo = await this.prisma.chatConversation.findUnique({ where: { id: conversationId } });
    if (!convo) throw new DomainException("NOT_FOUND", "Suhbat topilmadi.");
    if (convo.type === "DIRECT" && !who.isAdmin && convo.creatorUserId !== who.userId) {
      throw new DomainException("FORBIDDEN", "Bu suhbatga ruxsatingiz yo'q.");
    }
    return convo;
  }

  // ---- Reads ----

  async listConversations(who: ChatIdentity): Promise<ChatConversationView[]> {
    const groupId = await this.ensureGlobalGroup();
    if (who.creatorId) await this.ensureCreatorDirect(who.userId);
    await this.ensureGroupParticipant(groupId, who.userId);

    const where = who.isAdmin
      ? { OR: [{ type: "GROUP" as const }, { type: "DIRECT" as const }] }
      : { OR: [{ id: groupId }, { creatorUserId: who.userId }] };

    const convos = await this.prisma.chatConversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      take: 200,
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        participants: { where: { userId: who.userId }, take: 1 },
      },
    });

    // creatorUserId is a plain scalar (not a relation), so resolve the DIRECT threads' creator names
    // in one batched lookup rather than per-row.
    const creatorUserIds = convos.map((c) => c.creatorUserId).filter((id): id is string => !!id);
    const nameByUserId = new Map<string, string>();
    if (creatorUserIds.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: creatorUserIds } },
        select: { id: true, displayName: true, creatorProfile: { select: { displayName: true } } },
      });
      for (const u of users) nameByUserId.set(u.id, u.creatorProfile?.displayName ?? u.displayName ?? "Creator");
    }

    return convos.map((c) => {
      const last = c.messages[0] ?? null;
      const myCursor = c.participants[0]?.lastReadAt ?? null;
      const adminCursor = c.adminLastReadAt ?? null;
      let hasUnread = false;
      if (last) {
        if (c.type === "GROUP") {
          hasUnread = last.senderId !== who.userId && (!myCursor || last.createdAt > myCursor);
        } else if (who.isAdmin) {
          hasUnread = !last.senderIsAdmin && (!adminCursor || last.createdAt > adminCursor);
        } else {
          hasUnread = last.senderIsAdmin && (!myCursor || last.createdAt > myCursor);
        }
      }
      const title = c.type === "GROUP" ? c.title ?? GROUP_TITLE : (c.creatorUserId ? nameByUserId.get(c.creatorUserId) : null) ?? "Creator";
      return {
        id: c.id,
        type: c.type,
        title,
        lastMessage: last ? { body: last.body, createdAt: last.createdAt, senderIsAdmin: last.senderIsAdmin } : null,
        hasUnread,
      };
    });
  }

  async getMessages(conversationId: string, who: ChatIdentity, beforeId?: string): Promise<ChatMessageView[]> {
    await this.authorizeConversation(conversationId, who);
    const before = beforeId ? await this.prisma.chatMessage.findUnique({ where: { id: beforeId } }) : null;
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId, ...(before ? { createdAt: { lt: before.createdAt } } : {}) },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_PAGE,
      include: { sender: { select: { displayName: true, email: true, creatorProfile: { select: { displayName: true } } } } },
    });
    // Return oldest→newest for natural rendering; the query fetched newest-first only to page.
    return rows.reverse().map((m) => this.toMessageView(m, who));
  }

  // ---- Writes ----

  async sendMessage(conversationId: string, who: ChatIdentity, body: string): Promise<ChatMessageView> {
    const trimmed = body.trim();
    if (!trimmed) throw new DomainException("VALIDATION_ERROR", "Xabar bo'sh bo'lishi mumkin emas.");
    if (trimmed.length > 4000) throw new DomainException("VALIDATION_ERROR", "Xabar juda uzun (maksimal 4000 belgi).");
    const convo = await this.authorizeConversation(conversationId, who);
    if (convo.type === "GROUP") await this.ensureGroupParticipant(conversationId, who.userId);

    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { conversationId, senderId: who.userId, senderIsAdmin: who.isAdmin, body: trimmed },
        include: { sender: { select: { displayName: true, email: true, creatorProfile: { select: { displayName: true } } } } },
      }),
      this.prisma.chatConversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
    ]);
    return this.toMessageView(message, who);
  }

  async markRead(conversationId: string, who: ChatIdentity): Promise<void> {
    const convo = await this.authorizeConversation(conversationId, who);
    const now = new Date();
    if (convo.type === "DIRECT" && who.isAdmin) {
      await this.prisma.chatConversation.update({ where: { id: conversationId }, data: { adminLastReadAt: now } });
      return;
    }
    // Creator's own DIRECT cursor, or anyone's GROUP cursor — both live on their participant row.
    if (convo.type === "GROUP") await this.ensureGroupParticipant(conversationId, who.userId);
    await this.prisma.chatParticipant.updateMany({ where: { conversationId, userId: who.userId }, data: { lastReadAt: now } });
  }

  // Recipients (userIds) who should receive a live push for a message in this conversation — used by
  // the gateway to target socket rooms. For DIRECT that's the owning creator (admins listen on a
  // shared admin room instead); for GROUP it's every recorded participant.
  async roomTargetsFor(conversationId: string): Promise<{ type: "DIRECT" | "GROUP"; creatorUserId: string | null; participantUserIds: string[] }> {
    const convo = await this.prisma.chatConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { participants: { select: { userId: true } } },
    });
    return { type: convo.type, creatorUserId: convo.creatorUserId, participantUserIds: convo.participants.map((p) => p.userId) };
  }

  private toMessageView(
    m: {
      id: string;
      conversationId: string;
      senderId: string;
      senderIsAdmin: boolean;
      body: string;
      createdAt: Date;
      sender: { displayName: string | null; email: string | null; creatorProfile: { displayName: string | null } | null };
    },
    who: ChatIdentity,
  ): ChatMessageView {
    const senderName = m.sender.creatorProfile?.displayName ?? m.sender.displayName ?? (m.senderIsAdmin ? "Admin" : m.sender.email) ?? null;
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderIsAdmin: m.senderIsAdmin,
      senderName,
      body: m.body,
      createdAt: m.createdAt,
      mine: m.senderId === who.userId,
    };
  }
}
