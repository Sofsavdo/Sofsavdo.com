import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { StoragePort, StoredObject } from "./storage.port";

// S3-compatible cloud adapter (Phase A, production-hardening pass) — the same S3 API surface
// covers real AWS S3, Cloudflare R2, and GCS's S3-compatibility mode, so one adapter serves all
// three; which one is actually in front of it is just a matter of `storage.s3.endpoint` +
// `forcePathStyle` in configuration.ts. LocalDiskStorage remains the dev/test default; this
// adapter only activates when STORAGE_PROVIDER=s3 (see storage.module.ts).
@Injectable()
export class S3Storage implements StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    const s3Config = config.get<{
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      endpoint?: string;
      forcePathStyle: boolean;
      publicBaseUrl?: string;
    }>("storage.s3")!;

    this.bucket = s3Config.bucket;
    this.client = new S3Client({
      region: s3Config.region,
      credentials: { accessKeyId: s3Config.accessKeyId, secretAccessKey: s3Config.secretAccessKey },
      ...(s3Config.endpoint ? { endpoint: s3Config.endpoint, forcePathStyle: s3Config.forcePathStyle } : {}),
    });
    // A cloud provider almost always fronts the bucket with its own CDN/custom domain rather than
    // the raw bucket endpoint — publicBaseUrl lets that be configured independently of the
    // upload endpoint, same separation LocalDiskStorage already has between baseDir and baseUrl.
    this.baseUrl = (s3Config.publicBaseUrl ?? this.defaultPublicUrl(s3Config)).replace(/\/$/, "");
  }

  private defaultPublicUrl(s3Config: { endpoint?: string; bucket: string; region: string }): string {
    if (s3Config.endpoint) return `${s3Config.endpoint.replace(/\/$/, "")}/${s3Config.bucket}`;
    return `https://${s3Config.bucket}.s3.${s3Config.region}.amazonaws.com`;
  }

  // storageKey generation/sanitization is the caller's responsibility (see
  // CampaignMediaService.buildStorageKey) — this adapter, like LocalDiskStorage, trusts the key it
  // is given rather than re-deriving safety rules a second, possibly-inconsistent way.
  async put(storageKey: string, content: Buffer, mimeType: string): Promise<StoredObject> {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: content, ContentType: mimeType }));
    return { storageKey, publicUrl: this.publicUrl(storageKey) };
  }

  async remove(storageKey: string): Promise<void> {
    // S3's DeleteObject is already a no-op (not an error) for a key that doesn't exist — matches
    // StoragePort's contract with no extra handling needed, unlike LocalDiskStorage's explicit
    // ENOENT swallow.
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  publicUrl(storageKey: string): string {
    return `${this.baseUrl}/${storageKey}`;
  }
}
