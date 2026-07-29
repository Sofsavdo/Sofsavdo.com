import { ConfigService } from "@nestjs/config";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { S3Storage } from "./s3.storage";

jest.mock("@aws-sdk/client-s3");

describe("S3Storage", () => {
  let send: jest.Mock;

  function makeStorage(overrides: Partial<{ bucket: string; region: string; accessKeyId: string; secretAccessKey: string; endpoint?: string; forcePathStyle: boolean; publicBaseUrl?: string }> = {}) {
    send = jest.fn().mockResolvedValue({});
    (S3Client as unknown as jest.Mock).mockImplementation(() => ({ send }));
    const config = {
      get: jest.fn((key: string) =>
        key === "storage.s3"
          ? { bucket: "my-bucket", region: "auto", accessKeyId: "key", secretAccessKey: "secret", forcePathStyle: false, ...overrides }
          : undefined,
      ),
    };
    return new S3Storage(config as unknown as ConfigService);
  }

  beforeEach(() => jest.clearAllMocks());

  it("constructs without throwing even with blank credentials (safe to instantiate when driver=local)", () => {
    expect(() => makeStorage({ accessKeyId: "", secretAccessKey: "", bucket: "" })).not.toThrow();
  });

  it("uploads via PutObjectCommand and returns the computed public URL", async () => {
    const storage = makeStorage();
    const result = await storage.put("campaign-media/foo.jpg", Buffer.from("data"), "image/jpeg");
    expect(send).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    const call = (PutObjectCommand as unknown as jest.Mock).mock.calls[0][0];
    expect(call).toMatchObject({ Bucket: "my-bucket", Key: "campaign-media/foo.jpg", ContentType: "image/jpeg" });
    expect(result.publicUrl).toBe("https://my-bucket.s3.auto.amazonaws.com/campaign-media/foo.jpg");
  });

  it("removes via DeleteObjectCommand", async () => {
    const storage = makeStorage();
    await storage.remove("campaign-media/foo.jpg");
    expect(send).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    const call = (DeleteObjectCommand as unknown as jest.Mock).mock.calls[0][0];
    expect(call).toMatchObject({ Bucket: "my-bucket", Key: "campaign-media/foo.jpg" });
  });

  it("builds the public URL from a custom endpoint (R2/MinIO) when one is configured", () => {
    const storage = makeStorage({ endpoint: "https://accountid.r2.cloudflarestorage.com" });
    expect(storage.publicUrl("foo.jpg")).toBe("https://accountid.r2.cloudflarestorage.com/my-bucket/foo.jpg");
  });

  it("prefers an explicit publicBaseUrl override (a CDN/custom domain in front of the bucket) over the derived default", () => {
    const storage = makeStorage({ publicBaseUrl: "https://cdn.example.com/" });
    expect(storage.publicUrl("foo.jpg")).toBe("https://cdn.example.com/foo.jpg");
  });
});
