import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CampaignMedia } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import { STORAGE_PORT, type StoragePort } from "../storage/storage.port";
import { normalizeFilename, validateAndExtractMedia, type MediaValidationConfig } from "./media-validation";
import type { UploadMediaDto } from "./dto/upload-media.dto";

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

// Admin sees everything; creator-safe responses (below) never include storageKey or any
// provider/storage detail — see the spec's "internal storage keys ... must not be exposed in
// creator-safe responses."
export type CampaignMediaAdminResponse = CampaignMedia;

export interface CampaignMediaCreatorResponse {
  id: string;
  mediaType: string;
  mediaRole: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  sortOrder: number;
}

@Injectable()
export class CampaignMediaService {
  private readonly mediaConfig: MediaValidationConfig;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(STORAGE_PORT) private storage: StoragePort,
  ) {
    this.mediaConfig = this.config.get<MediaValidationConfig>("media")!;
  }

  private toCreatorResponse(m: CampaignMedia): CampaignMediaCreatorResponse {
    return {
      id: m.id,
      mediaType: m.mediaType,
      mediaRole: m.mediaRole,
      url: m.publicUrl,
      thumbnailUrl: m.thumbnailUrl,
      width: m.width,
      height: m.height,
      durationSeconds: m.durationSeconds,
      altText: m.altText,
      sortOrder: m.sortOrder,
    };
  }

  private async assertCampaignExists(campaignId: string): Promise<void> {
    const exists = await this.prisma.campaign.findUnique({ where: { id: campaignId }, select: { id: true } });
    if (!exists) throw new DomainException("NOT_FOUND", "Kampaniya topilmadi.");
  }

  async listForAdmin(campaignId: string): Promise<CampaignMediaAdminResponse[]> {
    await this.assertCampaignExists(campaignId);
    return this.prisma.campaignMedia.findMany({ where: { campaignId }, orderBy: { sortOrder: "asc" } });
  }

  // Used by CampaignsService to embed media in creator-safe catalog/detail responses.
  async listCreatorSafe(campaignId: string): Promise<CampaignMediaCreatorResponse[]> {
    const rows = await this.prisma.campaignMedia.findMany({ where: { campaignId }, orderBy: { sortOrder: "asc" } });
    return rows.map((m) => this.toCreatorResponse(m));
  }

  // Batched media lookup for the creator catalog LIST view — one query for every campaign card
  // instead of one query per card (CampaignsService.listForCreator uses this rather than calling
  // listCreatorSafe per-item).
  async listCreatorSafeForCampaigns(campaignIds: string[]): Promise<Map<string, CampaignMediaCreatorResponse[]>> {
    const map = new Map<string, CampaignMediaCreatorResponse[]>(campaignIds.map((id) => [id, []]));
    if (campaignIds.length === 0) return map;
    const rows = await this.prisma.campaignMedia.findMany({
      where: { campaignId: { in: campaignIds } },
      orderBy: { sortOrder: "asc" },
    });
    for (const row of rows) map.get(row.campaignId)?.push(this.toCreatorResponse(row));
    return map;
  }

  private buildStorageKey(campaignId: string, filename: string): string {
    return `campaigns/${campaignId}/${Date.now()}-${normalizeFilename(filename)}`;
  }

  async upload(campaignId: string, dto: UploadMediaDto, file: UploadedFile): Promise<CampaignMediaAdminResponse> {
    await this.assertCampaignExists(campaignId);

    if (dto.mediaRole === "COVER") {
      const existingCover = await this.prisma.campaignMedia.findFirst({ where: { campaignId, mediaRole: "COVER" } });
      if (existingCover) {
        throw new DomainException("COVER_ALREADY_EXISTS", "Ushbu kampaniyada allaqachon cover rasm mavjud — uni almashtirish uchun alohida amaldan foydalaning.");
      }
    }

    const meta = validateAndExtractMedia(file.buffer, file.mimetype, this.mediaConfig, {
      width: dto.width,
      height: dto.height,
      durationSeconds: dto.durationSeconds,
    });

    const storageKey = this.buildStorageKey(campaignId, file.originalname);
    const stored = await this.storage.put(storageKey, file.buffer, file.mimetype);

    return this.prisma.campaignMedia.create({
      data: {
        campaignId,
        mediaType: meta.mediaType,
        mediaRole: dto.mediaRole,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        originalFilename: normalizeFilename(file.originalname),
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        width: meta.width,
        height: meta.height,
        durationSeconds: meta.mediaType === "VIDEO" ? (dto.durationSeconds ?? null) : null,
        altText: dto.altText,
        sortOrder: await this.nextSortOrder(campaignId),
      },
    });
  }

  // Upload-and-replace in one action ("replacing the cover" in the admin UI spec) — deletes the
  // old cover's stored file and row, then creates the new one. Always succeeds regardless of
  // whether a cover already existed (unlike upload(), which rejects a second COVER).
  async replaceCover(campaignId: string, dto: UploadMediaDto, file: UploadedFile): Promise<CampaignMediaAdminResponse> {
    await this.assertCampaignExists(campaignId);
    const meta = validateAndExtractMedia(file.buffer, file.mimetype, this.mediaConfig, {
      width: dto.width,
      height: dto.height,
      durationSeconds: dto.durationSeconds,
    });

    const existingCover = await this.prisma.campaignMedia.findFirst({ where: { campaignId, mediaRole: "COVER" } });
    const storageKey = this.buildStorageKey(campaignId, file.originalname);
    const stored = await this.storage.put(storageKey, file.buffer, file.mimetype);

    const created = await this.prisma.$transaction(async (tx) => {
      if (existingCover) await tx.campaignMedia.delete({ where: { id: existingCover.id } });
      return tx.campaignMedia.create({
        data: {
          campaignId,
          mediaType: meta.mediaType,
          mediaRole: "COVER",
          storageKey: stored.storageKey,
          publicUrl: stored.publicUrl,
          originalFilename: normalizeFilename(file.originalname),
          mimeType: file.mimetype,
          fileSizeBytes: file.size,
          width: meta.width,
          height: meta.height,
          durationSeconds: meta.mediaType === "VIDEO" ? (dto.durationSeconds ?? null) : null,
          altText: dto.altText,
          sortOrder: existingCover?.sortOrder ?? 0,
        },
      });
    });

    if (existingCover) await this.storage.remove(existingCover.storageKey);
    return created;
  }

  // "Setting the cover" from an already-uploaded gallery/promotional item — promotes it to COVER,
  // demoting whatever was previously COVER back to GALLERY (never leaves two covers, never
  // leaves zero if one already existed).
  async promoteToCover(mediaId: string): Promise<CampaignMediaAdminResponse> {
    const media = await this.prisma.campaignMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new DomainException("MEDIA_NOT_FOUND", "Media topilmadi.");
    if (media.mediaRole === "COVER") return media;

    return this.prisma.$transaction(async (tx) => {
      const existingCover = await tx.campaignMedia.findFirst({ where: { campaignId: media.campaignId, mediaRole: "COVER" } });
      if (existingCover) await tx.campaignMedia.update({ where: { id: existingCover.id }, data: { mediaRole: "GALLERY" } });
      return tx.campaignMedia.update({ where: { id: mediaId }, data: { mediaRole: "COVER" } });
    });
  }

  private async nextSortOrder(campaignId: string): Promise<number> {
    const last = await this.prisma.campaignMedia.findFirst({ where: { campaignId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
    return (last?.sortOrder ?? -1) + 1;
  }

  // Only GALLERY/PROMOTIONAL items are reorderable — COVER is a single, separately-managed row
  // (see promoteToCover/replaceCover) whose position is always implicitly "shown first", so it's
  // deliberately excluded from both the validation set and the sortOrder renumbering below.
  async reorder(campaignId: string, orderedIds: string[]): Promise<CampaignMediaAdminResponse[]> {
    await this.assertCampaignExists(campaignId);
    const existing = await this.prisma.campaignMedia.findMany({ where: { campaignId, mediaRole: { not: "COVER" } }, select: { id: true } });
    const existingIds = new Set(existing.map((m) => m.id));
    if (orderedIds.length !== existingIds.size || !orderedIds.every((id) => existingIds.has(id))) {
      throw new DomainException("VALIDATION_ERROR", "orderedIds ushbu kampaniyaning galereya/promo media elementlarini aniq bir marta o'z ichiga olishi kerak.");
    }
    await this.prisma.$transaction(orderedIds.map((id, index) => this.prisma.campaignMedia.update({ where: { id }, data: { sortOrder: index } })));
    return this.listForAdmin(campaignId);
  }

  async updateAltText(mediaId: string, altText: string | undefined): Promise<CampaignMediaAdminResponse> {
    const media = await this.prisma.campaignMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new DomainException("MEDIA_NOT_FOUND", "Media topilmadi.");
    return this.prisma.campaignMedia.update({ where: { id: mediaId }, data: { altText } });
  }

  async remove(mediaId: string): Promise<void> {
    const media = await this.prisma.campaignMedia.findUnique({ where: { id: mediaId } });
    if (!media) throw new DomainException("MEDIA_NOT_FOUND", "Media topilmadi.");
    await this.prisma.campaignMedia.delete({ where: { id: mediaId } });
    await this.storage.remove(media.storageKey);
  }
}
