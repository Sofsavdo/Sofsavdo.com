import { Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import { memoryStorage } from "multer";
import { UploadsService, type UploadedFile as UploadedFileShape } from "./uploads.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { DomainException } from "../common/errors/domain-error";

// 8MB ceiling at the multer layer — UploadsService.uploadImage enforces the real, configurable
// media.maxImageBytes limit (5MB by default) itself; this is just a coarse first line of defense
// so an oversized request never even reaches that check.
const MULTER_OPTIONS = { storage: memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } };

function toUploadedFile(file?: Express.Multer.File): UploadedFileShape {
  if (!file) throw new DomainException("VALIDATION_ERROR", "Fayl yuklanmadi.");
  return { buffer: file.buffer, originalname: file.originalname, mimetype: file.mimetype, size: file.size };
}

@ApiTags("admin/uploads")
@ApiBearerAuth("bearer")
@Controller("admin/uploads")
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  // product.write — this exists today specifically for the Product form's image field (see
  // DECISIONS.md's Product Image Upload ADR); reused by any other admin form that needs a plain
  // image URL later, same as landing sections already do with a raw-URL textarea today.
  @RequirePermissions("product.write")
  @Post("image")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file", MULTER_OPTIONS))
  upload(@UploadedFile() file?: Express.Multer.File) {
    return this.uploads.uploadImage(toUploadedFile(file));
  }
}
