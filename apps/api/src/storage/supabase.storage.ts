import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { StoragePort } from "./storage.port";

@Injectable()
export class SupabaseStorage implements StoragePort {
  private _client: SupabaseClient | undefined;
  private bucket: string;

  constructor(private config: ConfigService) {
    this.bucket = this.config.get<string>("storage.supabase.bucket", "products");
  }

  // Lazy — this adapter is eagerly constructed by StorageModule regardless of which driver is
  // actually selected (STORAGE_DRIVER=local|s3|supabase), so throwing in the constructor would
  // block the app from booting in any environment without Supabase credentials configured, even
  // when Supabase isn't the driver in use. The error only surfaces if something actually tries to
  // use this adapter.
  private get client(): SupabaseClient {
    if (!this._client) {
      const url = this.config.get<string>("storage.supabase.url");
      const key = this.config.get<string>("storage.supabase.secretKey");
      if (!url || !key) {
        throw new Error("storage.supabase.url and storage.supabase.secretKey must be configured");
      }
      this._client = createClient(url, key);
    }
    return this._client;
  }

  async put(storageKey: string, content: Buffer, mimeType: string): Promise<{ storageKey: string; publicUrl: string }> {
    const { error } = await this.client
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
