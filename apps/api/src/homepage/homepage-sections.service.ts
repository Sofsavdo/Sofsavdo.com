import { Injectable } from "@nestjs/common";
import type { HomepageSection, HomepageSectionType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DomainException } from "../common/errors/domain-error";
import type { CreateHomepageSectionDto, UpdateHomepageSectionDto } from "./dto/homepage-section.dto";

export type HomepageSectionAvailability = "SCHEDULED" | "LIVE" | "EXPIRED" | "INACTIVE";

export interface HomepageSectionResponse {
  id: string;
  type: HomepageSectionType;
  sortOrder: number;
  isActive: boolean;
  content: Prisma.JsonValue;
  startsAt: Date | null;
  expiresAt: Date | null;
}

export interface PublicHomepageSectionResponse {
  type: HomepageSectionType;
  sortOrder: number;
  content: Prisma.JsonValue;
}

@Injectable()
export class HomepageSectionsService {
  constructor(private prisma: PrismaService) {}

  // Mirrors OffersService.computeAvailability's stored-flag-plus-computed-window shape (see
  // DECISIONS.md ADR-027) — redeclared here rather than shared, matching this codebase's own
  // convention of each service owning its model's availability logic (see CampaignsService's
  // equivalent against Campaign.startDate/endDate).
  computeAvailability(section: Pick<HomepageSection, "isActive" | "startsAt" | "expiresAt">, now: Date = new Date()): HomepageSectionAvailability {
    if (!section.isActive) return "INACTIVE";
    if (section.startsAt && section.startsAt > now) return "SCHEDULED";
    if (section.expiresAt && section.expiresAt < now) return "EXPIRED";
    return "LIVE";
  }

  private toResponse(section: HomepageSection): HomepageSectionResponse {
    return {
      id: section.id,
      type: section.type,
      sortOrder: section.sortOrder,
      isActive: section.isActive,
      content: section.content,
      startsAt: section.startsAt,
      expiresAt: section.expiresAt,
    };
  }

  // ---- Admin ----

  async list(): Promise<HomepageSectionResponse[]> {
    const sections = await this.prisma.homepageSection.findMany({ orderBy: { sortOrder: "asc" } });
    return sections.map((s) => this.toResponse(s));
  }

  async add(dto: CreateHomepageSectionDto): Promise<HomepageSectionResponse> {
    const count = await this.prisma.homepageSection.count();
    const section = await this.prisma.homepageSection.create({
      data: {
        type: dto.type,
        content: (dto.content ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? count,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
    return this.toResponse(section);
  }

  private async findOrThrow(id: string): Promise<HomepageSection> {
    const section = await this.prisma.homepageSection.findUnique({ where: { id } });
    if (!section) throw new DomainException("NOT_FOUND", "Homepage section topilmadi.");
    return section;
  }

  async update(id: string, dto: UpdateHomepageSectionDto): Promise<HomepageSectionResponse> {
    await this.findOrThrow(id);
    const section = await this.prisma.homepageSection.update({
      where: { id },
      data: {
        content: dto.content !== undefined ? (dto.content as Prisma.InputJsonValue) : undefined,
        isActive: dto.isActive,
        startsAt: dto.startsAt === undefined ? undefined : dto.startsAt === null ? null : new Date(dto.startsAt),
        expiresAt: dto.expiresAt === undefined ? undefined : dto.expiresAt === null ? null : new Date(dto.expiresAt),
      },
    });
    return this.toResponse(section);
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.homepageSection.delete({ where: { id } });
      const remaining = await tx.homepageSection.findMany({ orderBy: { sortOrder: "asc" } });
      await Promise.all(remaining.map((s, i) => tx.homepageSection.update({ where: { id: s.id }, data: { sortOrder: i } })));
    });
  }

  async reorder(orderedIds: string[]): Promise<HomepageSectionResponse[]> {
    const existing = await this.prisma.homepageSection.findMany();
    const existingIds = new Set(existing.map((s) => s.id));
    if (orderedIds.length !== existing.length || !orderedIds.every((id) => existingIds.has(id))) {
      throw new DomainException("VALIDATION_ERROR", "orderedIds barcha homepage sectionlarni aniq bir marta o'z ichiga olishi kerak.");
    }
    await this.prisma.$transaction(orderedIds.map((id, i) => this.prisma.homepageSection.update({ where: { id }, data: { sortOrder: i } })));
    return this.list();
  }

  // ---- Public (buyer-facing, no auth) ----

  // Only LIVE sections (isActive AND within any configured startsAt/expiresAt window) — an
  // unauthenticated caller must never see a scheduled/expired/toggled-off section, matching
  // LandingsService.getPublicByOfferSlug's isActive filter, extended with the time-window check
  // BANNER's scheduling needs.
  async listPublic(): Promise<PublicHomepageSectionResponse[]> {
    const sections = await this.prisma.homepageSection.findMany({ orderBy: { sortOrder: "asc" } });
    const now = new Date();
    return sections
      .filter((s) => this.computeAvailability(s, now) === "LIVE")
      .map((s) => ({ type: s.type, sortOrder: s.sortOrder, content: s.content }));
  }
}
