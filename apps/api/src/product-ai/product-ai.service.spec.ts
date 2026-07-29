import { Test } from "@nestjs/testing";
import { ProductAiService } from "./product-ai.service";
import { PRODUCT_AI_PORT, type ProductAiPort } from "./product-ai.port";
import { DomainException } from "../common/errors/domain-error";

describe("ProductAiService", () => {
  let service: ProductAiService;
  let port: { generateDraft: jest.Mock };

  beforeEach(async () => {
    port = { generateDraft: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [ProductAiService, { provide: PRODUCT_AI_PORT, useValue: port satisfies Partial<ProductAiPort> }],
    }).compile();
    service = moduleRef.get(ProductAiService);
  });

  it("rejects a request with neither imageUrls nor shortDescription", async () => {
    await expect(service.generateDraft({})).rejects.toThrow(DomainException);
    await expect(service.generateDraft({ imageUrls: [] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(port.generateDraft).not.toHaveBeenCalled();
  });

  it("delegates to the port when shortDescription alone is given", async () => {
    port.generateDraft.mockResolvedValue({ title: "x" });
    await service.generateDraft({ shortDescription: "a nice chair" });
    expect(port.generateDraft).toHaveBeenCalledWith({ imageUrls: [], productName: undefined, shortDescription: "a nice chair" });
  });

  it("delegates to the port when imageUrls alone is given", async () => {
    port.generateDraft.mockResolvedValue({ title: "x" });
    await service.generateDraft({ imageUrls: ["https://example.com/a.jpg"] });
    expect(port.generateDraft).toHaveBeenCalledWith({ imageUrls: ["https://example.com/a.jpg"], productName: undefined, shortDescription: undefined });
  });
});
