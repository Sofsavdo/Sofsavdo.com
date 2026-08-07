import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { ChatService, type ChatIdentity, type ChatMessageView } from "./chat.service";
import type { AccessTokenPayload } from "../auth/token.service";

function allowedOrigins(): string[] {
  const list = process.env.CORS_ALLOWED_ORIGINS;
  if (list && list.trim()) return list.split(",").map((o) => o.trim()).filter(Boolean);
  return [process.env.WEB_APP_URL ?? "http://localhost:3000"];
}

// Real-time push layer over the same messages the REST API persists. REST is the source of truth
// (send/list/mark-read all go through ChatController → ChatService); this gateway only fans a
// just-persisted message out to the other side's live sockets so open chats update instantly. If a
// socket is down, nothing is lost — the next REST list/getMessages call still returns everything.
@WebSocketGateway({ namespace: "/chat", cors: { origin: allowedOrigins(), credentials: true } })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private chat: ChatService,
    private jwt: JwtService,
    private config: ConfigService,
  ) {}

  // Authenticates the handshake (token in `auth.token` or `?token=`), then puts the socket into the
  // rooms it should receive pushes on. Unauthenticated/unauthorized sockets are disconnected.
  async handleConnection(client: Socket): Promise<void> {
    try {
      const raw = (client.handshake.auth?.token as string | undefined) ?? (client.handshake.query?.token as string | undefined);
      if (!raw) return this.reject(client);
      const token = raw.startsWith("Bearer ") ? raw.slice(7) : raw;
      let payload: AccessTokenPayload;
      try {
        payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.config.get<string>("jwt.accessSecret") });
      } catch {
        return this.reject(client);
      }
      const identity = await this.chat.resolveIdentity(payload.sub);
      if (!identity) return this.reject(client);

      client.data.identity = identity;
      client.join(this.userRoom(identity.userId));
      client.join("chat:group");
      if (identity.isAdmin) client.join("chat:admins");
    } catch (err) {
      this.logger.warn(`chat socket connection error: ${err instanceof Error ? err.message : String(err)}`);
      this.reject(client);
    }
  }

  // Fan a persisted message out to the appropriate rooms. Called by ChatController right after the
  // message is written. Receivers recompute `mine` from senderId against their own session, so the
  // per-viewer `mine` on the payload is ignored on the wire.
  async broadcast(conversationId: string, message: ChatMessageView): Promise<void> {
    if (!this.server) return;
    const targets = await this.chat.roomTargetsFor(conversationId);
    if (targets.type === "GROUP") {
      this.server.to("chat:group").emit("chat:message", message);
      return;
    }
    // DIRECT: the owning creator's personal room + the shared admin room.
    if (targets.creatorUserId) this.server.to(this.userRoom(targets.creatorUserId)).emit("chat:message", message);
    this.server.to("chat:admins").emit("chat:message", message);
  }

  private userRoom(userId: string): string {
    return `chat:user:${userId}`;
  }

  private reject(client: Socket): void {
    client.disconnect(true);
  }
}

export type { ChatIdentity };
