import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../common/audit/audit.service";
import { DomainException } from "../common/errors/domain-error";
import { SETTINGS_CATALOG, SETTING_CATEGORIES, type SettingCategory } from "./settings.catalog";

export interface SettingItem {
  key: string;
  category: SettingCategory;
  label: string;
  type: string;
  value: string | number | boolean;
}

// Real Settings management (Phase 12) over the pre-existing, previously-unused `Setting` model
// (Phase 1 pre-designed-but-unbuilt — same "extend, never supersede" precedent as every prior
// phase's first real use of an old model). An absent row for a catalog key means "use the
// catalog's default", so no backfill migration is needed the moment a new key is added to
// SETTINGS_CATALOG — same convention as NotificationPreference. See DECISIONS.md ADR-019 for why
// these values are stored-and-audited but not (yet) wired into other domains' runtime behavior.
@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async getAll(): Promise<SettingItem[]> {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: Object.keys(SETTINGS_CATALOG) } } });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return Object.entries(SETTINGS_CATALOG).map(([key, def]) => ({
      key,
      category: def.category,
      label: def.label,
      type: def.type,
      value: (byKey.has(key) ? byKey.get(key) : def.default) as string | number | boolean,
    }));
  }

  private validateValue(key: string, value: unknown): string | number | boolean {
    const def = SETTINGS_CATALOG[key];
    if (!def) throw new DomainException("INVALID_SETTING_VALUE", "Noma'lum sozlama kaliti.", { key });
    if (def.type === "string" && typeof value !== "string") throw new DomainException("INVALID_SETTING_VALUE", "Qiymat matn bo'lishi kerak.", { key });
    if (def.type === "number" && typeof value !== "number") throw new DomainException("INVALID_SETTING_VALUE", "Qiymat son bo'lishi kerak.", { key });
    if (def.type === "boolean" && typeof value !== "boolean") throw new DomainException("INVALID_SETTING_VALUE", "Qiymat true/false bo'lishi kerak.", { key });
    return value as string | number | boolean;
  }

  async update(values: Record<string, unknown>, actorId: string): Promise<SettingItem[]> {
    const keys = Object.keys(values);
    if (keys.length === 0) throw new DomainException("VALIDATION_ERROR", "Hech qanday sozlama yuborilmadi.");
    const validated = keys.map((key) => ({ key, value: this.validateValue(key, values[key]) }));

    const before = await this.getAll();
    const beforeByKey = new Map(before.map((s) => [s.key, s.value]));

    await this.prisma.$transaction(
      validated.map(({ key, value }) => this.prisma.setting.upsert({ where: { key }, update: { value: value }, create: { key, value: value } })),
    );

    await this.audit.record({
      actorId,
      action: "SETTINGS_UPDATED",
      entityType: "Setting",
      entityId: "global",
      before: Object.fromEntries(validated.map(({ key }) => [key, beforeByKey.get(key)])),
      after: Object.fromEntries(validated.map(({ key, value }) => [key, value])),
    });

    return this.getAll();
  }

  listCategories(): SettingCategory[] {
    return [...SETTING_CATEGORIES];
  }
}
