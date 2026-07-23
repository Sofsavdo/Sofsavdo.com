import { Body, Controller, Delete, Get, Param, Patch, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { ContentService, type UploadedFile as UploadedFileShape } from "./content.service";
import { CreateContentDto } from "./dto/create-content.dto";
import { UploadAttachmentDto } from "./dto/upload-attachment.dto";
import { RequireCreatorGuard } from "../common/guards/require-creator.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DomainException } from "../common/errors/domain-error";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

const MULTER_OPTIONS = { storage: memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } };

function toUploadedFile(file?: Express.Multer.File): UploadedFileShape {
  if (!file) throw new DomainException("VALIDATION_ERROR", "Fayl yuklanmadi.");
  return { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype, size: file.size };
}

// Ownership is enforced in the service (same id can never resolve to another creator's Content),
// not by RBAC permissions — same convention as Campaign Applications (see RBAC.md).
@ApiTags("creator/content")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller()
export class CreatorContentController {
  constructor(private content: ContentService) {}

  @Post("creator/campaigns/:campaignId/contents")
  create(@Param("campaignId") campaignId: string, @Body() dto: CreateContentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.content.create(campaignId, user.creatorId!, user.userId, dto);
  }

  @Get("creator/contents")
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.content.listMine(user.creatorId!);
  }

  @Get("creator/contents/dashboard-counts")
  dashboardCounts(@CurrentUser() user: AuthenticatedUser) {
    return this.content.getMyDashboardCounts(user.creatorId!);
  }

  @Get("creator/contents/:id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.findMineOrThrow(id, user.creatorId!);
  }

  @Patch("creator/contents/:id")
  update(@Param("id") id: string, @Body() dto: CreateContentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.content.updateDraft(id, user.creatorId!, user.userId, dto);
  }

  @Post("creator/contents/:id/submit")
  submit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.submit(id, user.creatorId!, user.userId);
  }

  @Post("creator/contents/:id/resubmit")
  resubmit(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.resubmit(id, user.creatorId!, user.userId);
  }

  @Post("creator/contents/:id/attachments")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", MULTER_OPTIONS))
  uploadAttachment(
    @Param("id") id: string,
    @Body() dto: UploadAttachmentDto,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.content.uploadAttachment(id, user.creatorId!, user.userId, dto, toUploadedFile(file));
  }
}

@ApiTags("creator/content")
@ApiBearerAuth("bearer")
@UseGuards(RequireCreatorGuard)
@Controller("creator/content-attachments")
export class CreatorContentAttachmentController {
  constructor(private content: ContentService) {}

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.content.removeAttachment(id, user.creatorId!, user.userId);
  }
}
