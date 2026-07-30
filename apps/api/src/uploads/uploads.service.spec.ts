import { Test } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { UploadsService } from "./uploads.service";
import { STORAGE_PORT } from "../storage/storage.port";

// A real, minimal valid PNG (1x1 pixel) — sniffMimeType checks real magic bytes, not the declared
// mimetype/filename, so a fake/text buffer would legitimately fail validation.
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

describe("UploadsService", () => {
  let service: UploadsService;
  let storage: { put: jest.Mock; remove: jest.Mock; publicUrl: jest.Mock };
  let config: { get: jest.Mock };

  beforeEach(async () => {
    storage = { put: jest.fn(), remove: jest.fn(), publicUrl: jest.fn() };
    config = { get: jest.fn().mockReturnValue(5 * 1024 * 1024) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: ConfigService, useValue: config },
        { provide: STORAGE_PORT, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(UploadsService);
  });

  it("stores a valid image and returns its public URL", async () => {
    storage.put.mockResolvedValue({ storageKey: "product-images/123-photo.png", publicUrl: "https://cdn.example/product-images/123-photo.png" });

    const result = await service.uploadImage({ buffer: PNG_1X1, originalname: "photo.png", mimetype: "image/png", size: PNG_1X1.length });

    expect(result).toEqual({ url: "https://cdn.example/product-images/123-photo.png" });
    expect(storage.put).toHaveBeenCalledWith(expect.stringMatching(/^product-images\/\d+-photo\.png$/), PNG_1X1, "image/png");
  });

  it("rejects a file whose real bytes aren't a known image format", async () => {
    const fake = Buffer.from("not a real image");
    await expect(
      service.uploadImage({ buffer: fake, originalname: "fake.png", mimetype: "image/png", size: fake.length }),
    ).rejects.toMatchObject({ code: "INVALID_MEDIA_TYPE" });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("rejects an image larger than the configured max", async () => {
    config.get.mockReturnValue(10);
    await expect(
      service.uploadImage({ buffer: PNG_1X1, originalname: "photo.png", mimetype: "image/png", size: PNG_1X1.length }),
    ).rejects.toMatchObject({ code: "MEDIA_TOO_LARGE" });
    expect(storage.put).not.toHaveBeenCalled();
  });
});
