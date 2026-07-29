import { promises as fs } from "fs";
import * as path from "path";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { StoragePort, StoredObject } from "./storage.port";

// Safe local/dev/test adapter — writes under a configurable directory (gitignored `uploads/` by
// default) and serves via the static /media mount in main.ts. Never used as a production CDN;
// a cloud adapter implements the same port when a real provider is configured.
@Injectable()
export class LocalDiskStorage implements StoragePort {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseDir = path.resolve(config.get<string>("storage.localDir")!);
    this.baseUrl = config.get<string>("storage.publicBaseUrl")!.replace(/\/$/, "");
  }

  // storageKey is generated server-side (see CampaignMediaService.buildStorageKey) and segments
  // are re-sanitized here so a hostile key could never traverse outside baseDir.
  private resolveSafe(storageKey: string): string {
    const safe = storageKey
      .split("/")
      .map((seg) => seg.replace(/[^a-zA-Z0-9._-]/g, "_"))
      .filter((seg) => seg && seg !== "." && seg !== "..")
      .join(path.sep);
    const full = path.resolve(this.baseDir, safe);
    if (!full.startsWith(this.baseDir)) throw new Error("Unsafe storage key");
    return full;
  }

  async put(storageKey: string, content: Buffer): Promise<StoredObject> {
    const full = this.resolveSafe(storageKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
    return { storageKey, publicUrl: this.publicUrl(storageKey) };
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await fs.unlink(this.resolveSafe(storageKey));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }

  publicUrl(storageKey: string): string {
    return `${this.baseUrl}/${storageKey.split(path.sep).join("/")}`;
  }
}
