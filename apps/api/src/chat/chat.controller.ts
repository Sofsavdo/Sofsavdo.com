import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ChatService, type ChatIdentity } from "./chat.service";
import { ChatGateway } from "./chat.gateway";
import { SendMessageDto } from "./dto/send-message.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";
import { DomainException } from "../common/errors/domain-error";

// REST is the source of truth for chat; ChatGateway only mirrors a just-sent message to live
// sockets. Every route is protected by the global JwtAuthGuard; buyers (neither creator nor staff)
// are rejected by identityOf.
@ApiTags("chat")
@ApiBearerAuth("bearer")
@Controller("chat")
export class ChatController {
  constructor(
    private chat: ChatService,
    private gateway: ChatGateway,
  ) {}

  private identityOf(user: AuthenticatedUser): ChatIdentity {
    const isAdmin = user.roleKeys.length > 0;
    if (!user.creatorId && !isAdmin) throw new DomainException("FORBIDDEN", "Chat faqat creator va adminlar uchun.");
    return { userId: user.userId, creatorId: user.creatorId, isAdmin };
  }

  @Get("conversations")
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.chat.listConversations(this.identityOf(user));
  }

  @Get("conversations/:id/messages")
  getMessages(@Param("id") id: string, @Query("before") before: string | undefined, @CurrentUser() user: AuthenticatedUser) {
    return this.chat.getMessages(id, this.identityOf(user), before);
  }

  @Post("conversations/:id/messages")
  async sendMessage(@Param("id") id: string, @Body() dto: SendMessageDto, @CurrentUser() user: AuthenticatedUser) {
    const message = await this.chat.sendMessage(id, this.identityOf(user), dto.body);
    // Fire-and-forget the live push; a socket delivery failure must never fail the send, since the
    // message is already durably persisted and the recipient's next REST fetch will include it.
    void this.gateway.broadcast(id, message).catch(() => undefined);
    return message;
  }

  @Post("conversations/:id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.chat.markRead(id, this.identityOf(user));
    return { ok: true };
  }
}
