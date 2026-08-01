import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(file: Express.Multer.File, folder: string = 'sofsavdo'): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(file.path, {
        folder,
        transformation: [
          { width: 800, height: 800, crop: 'fill' },
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ],
      });
      return result.secure_url;
    } catch (error) {
      throw new BadRequestException('Failed to upload image');
    }
  }

  async uploadProductImage(file: Express.Multer.File): Promise<string> {
    return this.uploadImage(file, 'sofsavdo/products');
  }

  async uploadCreatorImage(file: Express.Multer.File): Promise<string> {
    return this.uploadImage(file, 'sofsavdo/creators');
  }

  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new BadRequestException('Failed to delete image');
    }
  }
}
