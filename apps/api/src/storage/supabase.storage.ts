import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_PORT, type StoragePort } from "./storage.port";

@Injectable()
export class SupabaseStorage implements StoragePort {
  private client: SupabaseClient;
  private bucket: string;

  constructor(private config: ConfigService) {
    const url = this.config.get<string>("storage.supabase.url");
    const key = this.config.get<string>("storage.supabase.secretKey");
    this.bucket = this.config.get<string>("storage.supabase.bucket", "products");

    if (!url || !key) {
      throw new Error("storage.supabase.url and storage.supabase.secretKey must be configured");
    }

    this.client = createClient(url, key);
  }

  async put(storageKey: string, content: Buffer, mimeType: string): Promise<{ storageKey: string; publicUrl: string }> {
    const { data, error } = await this.client
      .storage
      .from(this.bucket)
      .upload(storageKey, content, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    const { data: { publicUrl } } = this.client
      .storage
      .from(this.bucket)
      .getPublicUrl(storageKey);

    return { storageKey, publicUrl };
  }

  async remove(storageKey: string): Promise<void> {
    const { error } = await this.client
      .storage
      .from(this.bucket)
      .remove([storageKey]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  publicUrl(storageKey: string): string {
    const { data } = this.client
      .storage
      .from(this.bucket)
      .getPublicUrl(storageKey);

    return data.publicUrl;
  }
}
