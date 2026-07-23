import { imageSize } from "image-size";
import { DomainException } from "../common/errors/domain-error";
import { sniffMimeType, normalizeFilename, ALLOWED_IMAGE_MIME_TYPES, ALLOWED_VIDEO_MIME_TYPES } from "../campaign-media/media-validation";

// Reuses the generic, byte-level MIME-sniffing/filename-normalization helpers from the Campaign
// Media domain (sniffMimeType/normalizeFilename are not Campaign-specific — see media-validation.ts)
// rather than duplicating them. Dimension enforcement below is Content-specific: general
// ATTACHMENT files have no forced frame, THUMBNAIL reuses the same 1080×1440 portrait standard as
// Campaign media for visual consistency.
export { normalizeFilename };

export interface ContentValidationConfig {
  maxAttachmentImageBytes: number;
  maxAttachmentVideoBytes: number;
  maxAttachmentVideoDurationSeconds: number;
  maxAttachmentsPerContent: number;
  thumbnailStandardWidth: number;
  thumbnailStandardHeight: number;
  thumbnailAspectRatioTolerance: number;
}

export interface ValidatedAttachmentMeta {
  attachmentType: "IMAGE" | "VIDEO";
  width: number | null;
  height: number | null;
}

function assertThumbnailFrame(width: number, height: number, config: ContentValidationConfig): void {
  if (width === config.thumbnailStandardWidth && height === config.thumbnailStandardHeight) return;
  const actualRatio = width / height;
  const targetRatio = config.thumbnailStandardWidth / config.thumbnailStandardHeight;
  if (Math.abs(actualRatio - targetRatio) > config.thumbnailAspectRatioTolerance) {
    throw new DomainException(
      "INVALID_MEDIA_DIMENSIONS",
      `Thumbnail ${config.thumbnailStandardWidth}×${config.thumbnailStandardHeight} (3:4 portret) formatiga mos kelishi kerak.`,
      { width, height, expectedWidth: config.thumbnailStandardWidth, expectedHeight: config.thumbnailStandardHeight },
    );
  }
}

// Never trusts the client-declared Content-Type — same real byte-signature sniffing as Campaign
// media. `role` gates whether the portrait-frame constraint applies: only THUMBNAIL needs a fixed
// aspect ratio ("image dimensions where required" — spec §Validation); a general ATTACHMENT image
// or video has no dimension requirement, only size/type/duration limits.
export function validateAndExtractAttachment(
  buffer: Buffer,
  declaredMimeType: string,
  role: "ATTACHMENT" | "THUMBNAIL",
  config: ContentValidationConfig,
  clientVideoMeta?: { width?: number; height?: number; durationSeconds?: number },
): ValidatedAttachmentMeta {
  const sniffed = sniffMimeType(buffer);
  if (!sniffed) {
    throw new DomainException("INVALID_MEDIA_TYPE", "Fayl tarkibi ruxsat etilgan rasm yoki video formatiga mos kelmadi.");
  }

  const isImage = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(sniffed);
  const isVideo = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(sniffed);
  if (!isImage && !isVideo) {
    throw new DomainException("INVALID_MEDIA_TYPE", "Ruxsat etilmagan fayl turi.", { detectedType: sniffed });
  }
  if (role === "THUMBNAIL" && isVideo) {
    throw new DomainException("INVALID_MEDIA_TYPE", "Thumbnail faqat rasm bo'lishi mumkin.");
  }
  const declaredIsImage = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(declaredMimeType);
  const declaredIsVideo = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(declaredMimeType);
  if ((isImage && !declaredIsImage) || (isVideo && !declaredIsVideo)) {
    throw new DomainException("INVALID_MEDIA_TYPE", "E'lon qilingan fayl turi haqiqiy tarkibga mos kelmadi.");
  }

  if (isImage) {
    if (buffer.length > config.maxAttachmentImageBytes) {
      throw new DomainException("MEDIA_TOO_LARGE", "Rasm hajmi ruxsat etilgan maksimal hajmdan katta.", {
        maxBytes: config.maxAttachmentImageBytes,
      });
    }
    let dims: { width: number; height: number };
    try {
      const result = imageSize(buffer);
      if (!result.width || !result.height) throw new Error("no dimensions");
      dims = { width: result.width, height: result.height };
    } catch {
      throw new DomainException("INVALID_MEDIA_TYPE", "Rasm o'lchamlarini aniqlab bo'lmadi — fayl buzilgan bo'lishi mumkin.");
    }
    if (role === "THUMBNAIL") assertThumbnailFrame(dims.width, dims.height, config);
    return { attachmentType: "IMAGE", width: dims.width, height: dims.height };
  }

  // VIDEO (always ATTACHMENT — THUMBNAIL rejected videos above)
  if (buffer.length > config.maxAttachmentVideoBytes) {
    throw new DomainException("MEDIA_TOO_LARGE", "Video hajmi ruxsat etilgan maksimal hajmdan katta.", {
      maxBytes: config.maxAttachmentVideoBytes,
    });
  }
  if (clientVideoMeta?.durationSeconds != null && clientVideoMeta.durationSeconds > config.maxAttachmentVideoDurationSeconds) {
    throw new DomainException("INVALID_MEDIA_DURATION", "Video davomiyligi ruxsat etilgan maksimal davomiylikdan uzun.", {
      maxSeconds: config.maxAttachmentVideoDurationSeconds,
    });
  }
  return { attachmentType: "VIDEO", width: clientVideoMeta?.width ?? null, height: clientVideoMeta?.height ?? null };
}
