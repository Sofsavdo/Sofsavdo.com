import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainException } from "../common/errors/domain-error";
import { STORAGE_PORT, type StoragePort } from "../storage/storage.port";
import { ALLOWED_IMAGE_MIME_TYPES, normalizeFilename, sniffMimeType } from "../campaign-media/media-validation";

export interface UploadedFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

// A small, generic image-upload endpoint — deliberately NOT built on top of CampaignMediaService's
// richer model (CampaignMedia has its own table with cover/gallery roles, width/height, a
// storageKey per row). Product.images is just a `string[]` of public URLs today; a matching
// dedicated ProductMedia model would be over-engineering relative to what the schema actually
// needs. This also does NOT reuse validateAndExtractMedia's aspect-ratio check — that enforces
// Campaign media's specific 3:4 portrait requirement, which has nothing to do with a normal
// product photo (square, landscape, whatever the product actually looks like).
@Injectable()
export class UploadsService {
  constructor(
    private config: ConfigService,
    @Inject(STORAGE_PORT) private storage: StoragePort,
  ) {}

  async uploadImage(file: UploadedFile): Promise<{ url: string }> {
    const sniffed = sniffMimeType(file.buffer);
    if (!sniffed || !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(sniffed)) {
      throw new DomainException("INVALID_MEDIA_TYPE", "Fayl tarkibi ruxsat etilgan rasm formatiga (JPEG/PNG/WEBP) mos kelmadi.");
    }

    const maxBytes = this.config.get<number>("media.maxImageBytes")!;
    if (file.buffer.length > maxBytes) {
      throw new DomainException("MEDIA_TOO_LARGE", "Rasm hajmi ruxsat etilgan maksimal hajmdan katta.", { maxBytes });
    }

    const storageKey = `product-images/${Date.now()}-${normalizeFilename(file.originalname)}`;
    const stored = await this.storage.put(storageKey, file.buffer, sniffed);
    return { url: stored.publicUrl };
  }
}
