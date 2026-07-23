import { normalizeFilename, sniffMimeType, validateAndExtractMedia, type MediaValidationConfig } from "./media-validation";
import { buildTestPng } from "./test-helpers/build-test-png";

const CONFIG: MediaValidationConfig = {
  maxImageBytes: 5 * 1024 * 1024,
  maxVideoBytes: 100 * 1024 * 1024,
  maxVideoDurationSeconds: 300,
  standardWidth: 1080,
  standardHeight: 1440,
  aspectRatioTolerance: 0.02,
};

// A minimal, real MP4 "ftyp" box header — enough for sniffMimeType's signature check (this file
// doesn't decode real video frames; see media-validation.ts's honesty comment on why).
function fakeMp4Header(): Buffer {
  const buf = Buffer.alloc(20);
  buf.writeUInt32BE(20, 0);
  buf.write("ftyp", 4, "ascii");
  buf.write("isom", 8, "ascii");
  return buf;
}

describe("sniffMimeType", () => {
  it("recognizes a real PNG by magic bytes", () => {
    expect(sniffMimeType(buildTestPng(100, 100))).toBe("image/png");
  });

  it("recognizes a real MP4 by its ftyp box", () => {
    expect(sniffMimeType(fakeMp4Header())).toBe("video/mp4");
  });

  it("returns null for arbitrary/executable content (no known signature)", () => {
    // MZ header — the actual signature of a Windows PE executable.
    expect(sniffMimeType(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]))).toBeNull();
  });

  it("returns null for a text file with a .jpg extension (renamed, not real image content)", () => {
    expect(sniffMimeType(Buffer.from("<?php system($_GET['c']); ?>"))).toBeNull();
  });
});

describe("normalizeFilename", () => {
  it("strips path separators to prevent directory traversal", () => {
    expect(normalizeFilename("../../etc/passwd")).not.toContain("..");
    expect(normalizeFilename("C:\\Windows\\evil.jpg")).toBe("evil.jpg");
  });

  it("replaces unsafe characters", () => {
    expect(normalizeFilename("my photo!@#.jpg")).toBe("my_photo___.jpg");
  });

  it("falls back to a safe default for an empty/fully-stripped name", () => {
    expect(normalizeFilename("...")).toBe("upload");
  });
});

describe("validateAndExtractMedia — images", () => {
  it("accepts an exact 1080×1440 image", () => {
    const buf = buildTestPng(1080, 1440);
    const result = validateAndExtractMedia(buf, "image/png", CONFIG);
    expect(result).toEqual({ mediaType: "IMAGE", width: 1080, height: 1440 });
  });

  it("accepts an image within aspect-ratio tolerance (not exactly 1080×1440)", () => {
    // 810x1080 has the exact same 3:4 ratio as 1080x1440, just smaller — must pass.
    const buf = buildTestPng(810, 1080);
    const result = validateAndExtractMedia(buf, "image/png", CONFIG);
    expect(result.width).toBe(810);
  });

  it("rejects an image outside the aspect-ratio tolerance with INVALID_MEDIA_DIMENSIONS", () => {
    const buf = buildTestPng(1080, 1080); // square, not 3:4
    expect(() => validateAndExtractMedia(buf, "image/png", CONFIG)).toThrow(
      expect.objectContaining({ code: "INVALID_MEDIA_DIMENSIONS" }),
    );
  });

  it("rejects a declared-image-but-not-really-an-image buffer with INVALID_MEDIA_TYPE", () => {
    const fakeText = Buffer.from("not an image");
    expect(() => validateAndExtractMedia(fakeText, "image/jpeg", CONFIG)).toThrow(
      expect.objectContaining({ code: "INVALID_MEDIA_TYPE" }),
    );
  });

  it("rejects executable content disguised with an image Content-Type with INVALID_MEDIA_TYPE", () => {
    const exeBytes = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    expect(() => validateAndExtractMedia(exeBytes, "image/jpeg", CONFIG)).toThrow(
      expect.objectContaining({ code: "INVALID_MEDIA_TYPE" }),
    );
  });

  it("rejects an image exceeding the max byte size with MEDIA_TOO_LARGE", () => {
    const buf = buildTestPng(1080, 1440);
    const tinyConfig: MediaValidationConfig = { ...CONFIG, maxImageBytes: 10 };
    expect(() => validateAndExtractMedia(buf, "image/png", tinyConfig)).toThrow(expect.objectContaining({ code: "MEDIA_TOO_LARGE" }));
  });

  it("rejects a mismatched declared type vs. real content (video field, image bytes)", () => {
    const buf = buildTestPng(1080, 1440);
    expect(() => validateAndExtractMedia(buf, "video/mp4", CONFIG)).toThrow(expect.objectContaining({ code: "INVALID_MEDIA_TYPE" }));
  });
});

describe("validateAndExtractMedia — videos", () => {
  it("accepts a real MP4 within size/duration/dimension bounds", () => {
    const result = validateAndExtractMedia(fakeMp4Header(), "video/mp4", CONFIG, {
      width: 1080,
      height: 1440,
      durationSeconds: 60,
    });
    expect(result).toEqual({ mediaType: "VIDEO", width: 1080, height: 1440 });
  });

  it("rejects a video exceeding the max duration with INVALID_MEDIA_DURATION", () => {
    expect(() =>
      validateAndExtractMedia(fakeMp4Header(), "video/mp4", CONFIG, { durationSeconds: CONFIG.maxVideoDurationSeconds + 1 }),
    ).toThrow(expect.objectContaining({ code: "INVALID_MEDIA_DURATION" }));
  });

  it("rejects a video exceeding the max byte size with MEDIA_TOO_LARGE", () => {
    const tinyConfig: MediaValidationConfig = { ...CONFIG, maxVideoBytes: 5 };
    expect(() => validateAndExtractMedia(fakeMp4Header(), "video/mp4", tinyConfig)).toThrow(
      expect.objectContaining({ code: "MEDIA_TOO_LARGE" }),
    );
  });

  it("rejects a video with client-reported dimensions outside the aspect-ratio tolerance", () => {
    expect(() => validateAndExtractMedia(fakeMp4Header(), "video/mp4", CONFIG, { width: 1000, height: 1000 })).toThrow(
      expect.objectContaining({ code: "INVALID_MEDIA_DIMENSIONS" }),
    );
  });

  it("accepts a video with no client-reported dimensions at all (best-effort, not required)", () => {
    const result = validateAndExtractMedia(fakeMp4Header(), "video/mp4", CONFIG);
    expect(result).toEqual({ mediaType: "VIDEO", width: null, height: null });
  });
});
