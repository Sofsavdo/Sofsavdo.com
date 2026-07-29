import { Test } from "@nestjs/testing";
import { BRAND } from "../config/brand";
import { SettingsService } from "./settings.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";

describe("SettingsService (Phase 12)", () => {
  let service: SettingsService;
  let prisma: { setting: { findMany: jest.Mock; upsert: jest.Mock }; $transaction: jest.Mock };
  let audit: { record: jest.Mock };

  beforeEach(async () => {
    prisma = {
      setting: { findMany: jest.fn(), upsert: jest.fn() },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(async (ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
    audit = { record: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [SettingsService, { provide: PrismaService, useValue: prisma }, { provide: AuditService, useValue: audit }],
    }).compile();
    service = moduleRef.get(SettingsService);
  });

  describe("getAll", () => {
    it("falls back to the catalog default when no Setting row exists", async () => {
      prisma.setting.findMany.mockResolvedValue([]);
      const result = await service.getAll();
      const platformName = result.find((s) => s.key === "general.platformName");
      expect(platformName?.value).toBe(BRAND.name);
    });

    it("uses the stored value when a Setting row exists", async () => {
      prisma.setting.findMany.mockResolvedValue([{ key: "general.platformName", value: "Custom Name" }]);
      const result = await service.getAll();
      const platformName = result.find((s) => s.key === "general.platformName");
      expect(platformName?.value).toBe("Custom Name");
    });

    it("covers all 7 required categories", async () => {
      prisma.setting.findMany.mockResolvedValue([]);
      const result = await service.getAll();
      const categories = new Set(result.map((s) => s.category));
      expect(categories).toEqual(
        new Set(["general", "commission", "creatorDefaults", "notificationDefaults", "paymentConfiguration", "featureFlags", "validationRules"]),
      );
    });
  });

  describe("update", () => {
    it("throws VALIDATION_ERROR when no values are given", async () => {
      await expect(service.update({}, "actor1")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    });

    it("throws INVALID_SETTING_VALUE for an unknown key", async () => {
      await expect(service.update({ "not.a.real.key": 1 }, "actor1")).rejects.toMatchObject({ code: "INVALID_SETTING_VALUE" });
    });

    it("throws INVALID_SETTING_VALUE when the type doesn't match the catalog", async () => {
      await expect(service.update({ "general.platformName": 123 }, "actor1")).rejects.toMatchObject({ code: "INVALID_SETTING_VALUE" });
    });

    it("upserts each valid key and records one audit entry with before/after", async () => {
      prisma.setting.findMany.mockResolvedValue([]);
      await service.update({ "general.platformName": "New Name", "featureFlags.maintenanceMode": true }, "actor1");
      expect(prisma.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { key: "general.platformName" }, create: { key: "general.platformName", value: "New Name" } }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SETTINGS_UPDATED",
          after: expect.objectContaining({ "general.platformName": "New Name", "featureFlags.maintenanceMode": true }),
        }),
      );
    });
  });
});
