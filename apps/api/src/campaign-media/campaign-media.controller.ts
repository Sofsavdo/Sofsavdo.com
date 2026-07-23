import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { CampaignMediaService, type UploadedFile as UploadedFileShape } from "./campaign-media.service";
import { UploadMediaDto } from "./dto/upload-media.dto";
import { ReorderMediaDto } from "./dto/reorder-media.dto";
import { UpdateMediaDto } from "./dto/update-media.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { DomainException } from "../common/errors/domain-error";

// Media management is a sub-resource of Campaign editing — gated by "campaign.write", the same
// permission that gates every other Campaign admin mutation (see permissions.constants.ts's
// comment; matches the existing landing-sections-under-landing.write pattern).
const MULTER_OPTIONS = { storage: memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } };

function toUploadedFile(file?: Express.Multer.File): UploadedFileShape {
  if (!file) throw new DomainException("VALIDATION_ERROR", "Fayl yuklanmadi.");
  return { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype, size: file.size };
}

@ApiTags("admin/campaign-media")
@ApiBearerAuth("bearer")
@Controller("admin/campaigns/:campaignId/media")
export class CampaignMediaController {
  constructor(private media: CampaignMediaService) {}

  @RequirePermissions("campaign.write")
  @Get()
  list(@Param("campaignId") campaignId: string) {
    return this.media.listForAdmin(campaignId);
  }

  @RequirePermissions("campaign.write")
  @Post()
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", MULTER_OPTIONS))
  upload(@Param("campaignId") campaignId: string, @Body() dto: UploadMediaDto, @UploadedFile() file?: Express.Multer.File) {
    return this.media.upload(campaignId, dto, toUploadedFile(file));
  }

  @RequirePermissions("campaign.write")
  @Post("cover")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", MULTER_OPTIONS))
  replaceCover(@Param("campaignId") campaignId: string, @Body() dto: UploadMediaDto, @UploadedFile() file?: Express.Multer.File) {
    return this.media.replaceCover(campaignId, dto, toUploadedFile(file));
  }

  @RequirePermissions("campaign.write")
  @Post("reorder")
  reorder(@Param("campaignId") campaignId: string, @Body() dto: ReorderMediaDto) {
    return this.media.reorder(campaignId, dto.orderedIds);
  }
}

@ApiTags("admin/campaign-media")
@ApiBearerAuth("bearer")
@Controller("admin/campaign-media")
export class CampaignMediaItemController {
  constructor(private media: CampaignMediaService) {}

  @RequirePermissions("campaign.write")
  @Patch(":id/set-cover")
  setCover(@Param("id") id: string) {
    return this.media.promoteToCover(id);
  }

  @RequirePermissions("campaign.write")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateMediaDto) {
    return this.media.updateAltText(id, dto.altText);
  }

  @RequirePermissions("campaign.write")
  @Delete(":id")
  @HttpCode(204)
  async remove(@Param("id") id: string) {
    await this.media.remove(id);
  }
}
