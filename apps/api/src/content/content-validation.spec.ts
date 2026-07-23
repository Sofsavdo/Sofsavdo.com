import { buildTestPng } from "../campaign-media/test-helpers/build-test-png";
import { validateAndExtractAttachment, normalizeFilename, type ContentValidationConfig } from "./content-validation";

const config: ContentValidationConfig = {
  maxAttachmentImageBytes: 5 * 1024 * 1024,
  maxAttachmentVideoBytes: 100 * 1024 * 1024,
  maxAttachmentVideoDurationSeconds: 300,
  maxAttachmentsPerContent: 10,
  thumbnailStandardWidth: 1080,
  thumbnailStandardHeight: 1440,
  thumbnailAspectRatioTolerance: 0.02,
};

function mp4Bytes(): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeUInt32BE(16, 0);
  buf.write("ftyp", 4, "ascii");
  buf.write("isom", 8, "ascii");
  return buf;
}

describe("content-validation", () => {
  describe("normalizeFilename (reused from Campaign Media)", () => {
    it("strips path separators and unsafe characters", () => {
      expect(normalizeFilename("../../evil.jpg")).toBe("evil.jpg");
    });
  });

  describe("validateAndExtractAttachment", () => {
    it("rejects a file whose real bytes don't match any known signature (renamed executable)", () => {
      const fakeExe = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // MZ header
      expect(() => validateAndExtractAttachment(fakeExe, "image/jpeg", "ATTACHMENT", config)).toThrow(
        expect.objectContaining({ code: "INVALID_MEDIA_TYPE" }),
      );
    });

    it("accepts a general ATTACHMENT image at any dimensions — no forced frame", () => {
      const png = buildTestPng(400, 300);
      const meta = validateAndExtractAttachment(png, "image/png", "ATTACHMENT", config);
      expect(meta).toEqual({ attachmentType: "IMAGE", width: 400, height: 300 });
    });

    it("rejects an oversized image attachment", () => {
      const png = buildTestPng(2000, 2000);
      expect(() =>
        validateAndExtractAttachment(png, "image/png", "ATTACHMENT", { ...config, maxAttachmentImageBytes: 10 }),
      ).toThrow(expect.objectContaining({ code: "MEDIA_TOO_LARGE" }));
    });

    it("THUMBNAIL requires the same 1080x1440 portrait frame as Campaign media", () => {
      const wrongSize = buildTestPng(500, 500);
      expect(() => validateAndExtractAttachment(wrongSize, "image/png", "THUMBNAIL", config)).toThrow(
        expect.objectContaining({ code: "INVALID_MEDIA_DIMENSIONS" }),
      );
    });

    it("THUMBNAIL accepts the exact standard frame", () => {
      const exact = buildTestPng(1080, 1440);
      const meta = validateAndExtractAttachment(exact, "image/png", "THUMBNAIL", config);
      expect(meta).toEqual({ attachmentType: "IMAGE", width: 1080, height: 1440 });
    });

    it("rejects a THUMBNAIL uploaded as a video", () => {
      const video = mp4Bytes();
      expect(() => validateAndExtractAttachment(video, "video/mp4", "THUMBNAIL", config)).toThrow(
        expect.objectContaining({ code: "INVALID_MEDIA_TYPE" }),
      );
    });

    it("accepts a video ATTACHMENT with client-reported duration within the limit", () => {
      const video = mp4Bytes();
      const meta = validateAndExtractAttachment(video, "video/mp4", "ATTACHMENT", config, { durationSeconds: 60 });
      expect(meta.attachmentType).toBe("VIDEO");
    });

    it("rejects a video ATTACHMENT exceeding the max duration", () => {
      const video = mp4Bytes();
      expect(() => validateAndExtractAttachment(video, "video/mp4", "ATTACHMENT", config, { durationSeconds: 600 })).toThrow(
        expect.objectContaining({ code: "INVALID_MEDIA_DURATION" }),
      );
    });

    it("rejects a declared-image-but-actually-video mismatch", () => {
      const video = mp4Bytes();
      expect(() => validateAndExtractAttachment(video, "image/jpeg", "ATTACHMENT", config)).toThrow(
        expect.objectContaining({ code: "INVALID_MEDIA_TYPE" }),
      );
    });
  });
});
