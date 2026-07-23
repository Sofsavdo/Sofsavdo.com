import { imageSize } from "image-size";
import { DomainException } from "../common/errors/domain-error";

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_VIDEO_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

// Real, buffer-level magic-byte signatures — never trust the client-declared Content-Type/
// filename extension alone (that's how a renamed .exe gets past a naive extension check). Each
// entry is checked against the start of the actual uploaded bytes.
const SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF....WEBP — WEBP checked separately below
  { mime: "video/mp4", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // "ftyp" box
  { mime: "video/webm", bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { mime: "video/quicktime", bytes: [0x66, 0x74, 0x79, 0x70], offset: 4 }, // same ftyp box as mp4; mime disambiguated by declared type
];

// Rejects anything whose real bytes don't match a known-safe signature — this is the actual
// "no executable content" enforcement (an .exe/.sh/.php renamed to .jpg fails every signature
// check below and is rejected regardless of what Content-Type the client claims).
export function sniffMimeType(buffer: Buffer): string | null {
  for (const sig of SIGNATURES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    const matches = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (matches) {
      if (sig.mime === "image/webp") {
        // RIFF container also backs other formats (WAV/AVI) — confirm the "WEBP" fourcc at byte 8.
        if (buffer.length >= 12 && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
        continue;
      }
      return sig.mime;
    }
  }
  return null;
}

export interface MediaValidationConfig {
  maxImageBytes: number;
  maxVideoBytes: number;
  maxVideoDurationSeconds: number;
  standardWidth: number;
  standardHeight: number;
  aspectRatioTolerance: number;
}

export interface ValidatedMediaMeta {
  mediaType: "IMAGE" | "VIDEO";
  width: number | null;
  height: number | null;
}

// Safe filename normalization: strip path separators and anything that isn't alnum/dot/dash/
// underscore, so a hostile "../../evil.jpg" or "file\x00.jpg" can never escape its intended
// storage folder or confuse a downstream tool.
export function normalizeFilename(original: string): string {
  const base = original.replace(/^.*[/\\]/, "");
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
  // A name that's nothing but dots (".", "..", "...") is exactly the traversal pattern this
  // function exists to neutralize — treat it the same as an empty name.
  return cleaned && /[a-zA-Z0-9_-]/.test(cleaned) ? cleaned : "upload";
}

// Client-declared width/height/durationSeconds for VIDEO are honesty-flagged, not silently
// trusted as gospel: there is no ffprobe-equivalent dependency in this codebase to decode real
// video frame dimensions/duration server-side (a real binary video parser is a materially heavier
// dependency than this checkpoint's scope — see DECISIONS.md ADR-013's "known limitation" note).
// IMAGE dimensions, by contrast, ARE read from the real decoded buffer via `image-size` below —
// never from client-declared values — because that library needs no extra system dependency and
// is cheap to run in-process.
export function validateAndExtractMedia(
  buffer: Buffer,
  declaredMimeType: string,
  config: MediaValidationConfig,
  clientVideoMeta?: { width?: number; height?: number; durationSeconds?: number },
): ValidatedMediaMeta {
  const sniffed = sniffMimeType(buffer);
  if (!sniffed) {
    throw new DomainException("INVALID_MEDIA_TYPE", "Fayl tarkibi ruxsat etilgan rasm yoki video formatiga mos kelmadi.");
  }

  const isImage = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(sniffed);
  const isVideo = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(sniffed);
  if (!isImage && !isVideo) {
    throw new DomainException("INVALID_MEDIA_TYPE", "Ruxsat etilmagan fayl turi.", { detectedType: sniffed });
  }
  // The client-declared Content-Type must at least agree on image-vs-video with the sniffed
  // reality — catches the case of a video uploaded through the image field or vice versa.
  const declaredIsImage = (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(declaredMimeType);
  const declaredIsVideo = (ALLOWED_VIDEO_MIME_TYPES as readonly string[]).includes(declaredMimeType);
  if ((isImage && !declaredIsImage) || (isVideo && !declaredIsVideo)) {
    throw new DomainException("INVALID_MEDIA_TYPE", "E'lon qilingan fayl turi haqiqiy tarkibga mos kelmadi.");
  }

  if (isImage) {
    if (buffer.length > config.maxImageBytes) {
      throw new DomainException("MEDIA_TOO_LARGE", "Rasm hajmi ruxsat etilgan maksimal hajmdan katta.", {
        maxBytes: config.maxImageBytes,
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
    assertPortraitFrame(dims.width, dims.height, config);
    return { mediaType: "IMAGE", width: dims.width, height: dims.height };
  }

  // VIDEO
  if (buffer.length > config.maxVideoBytes) {
    throw new DomainException("MEDIA_TOO_LARGE", "Video hajmi ruxsat etilgan maksimal hajmdan katta.", { maxBytes: config.maxVideoBytes });
  }
  if (clientVideoMeta?.durationSeconds != null && clientVideoMeta.durationSeconds > config.maxVideoDurationSeconds) {
    throw new DomainException("INVALID_MEDIA_DURATION", "Video davomiyligi ruxsat etilgan maksimal davomiylikdan uzun.", {
      maxSeconds: config.maxVideoDurationSeconds,
    });
  }
  if (clientVideoMeta?.width != null && clientVideoMeta?.height != null) {
    assertPortraitFrame(clientVideoMeta.width, clientVideoMeta.height, config);
  }
  return { mediaType: "VIDEO", width: clientVideoMeta?.width ?? null, height: clientVideoMeta?.height ?? null };
}

function assertPortraitFrame(width: number, height: number, config: MediaValidationConfig): void {
  if (width === config.standardWidth && height === config.standardHeight) return;
  const actualRatio = width / height;
  const targetRatio = config.standardWidth / config.standardHeight;
  if (Math.abs(actualRatio - targetRatio) > config.aspectRatioTolerance) {
    throw new DomainException(
      "INVALID_MEDIA_DIMENSIONS",
      `Media ${config.standardWidth}×${config.standardHeight} (3:4 portret) formatiga mos kelishi kerak.`,
      { width, height, expectedWidth: config.standardWidth, expectedHeight: config.standardHeight },
    );
  }
}
