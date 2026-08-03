import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalDiskStorage } from "./local-disk.storage";
import { S3Storage } from "./s3.storage";
import { SupabaseStorage } from "./supabase.storage";
import { STORAGE_PORT } from "./storage.port";

// Global: every domain that needs to store a file (Campaign media today; avatar/content uploads
// later) injects STORAGE_PORT rather than importing a concrete adapter. Which concrete adapter
// backs it is env-driven (STORAGE_DRIVER=local|s3|supabase, see configuration.ts) — swapping providers is a
// deploy-time config change, never a code change in any domain module.
@Global()
@Module({
  providers: [
    LocalDiskStorage,
    S3Storage,
    SupabaseStorage,
    {
      provide: STORAGE_PORT,
      useFactory: (config: ConfigService, local: LocalDiskStorage, s3: S3Storage, supabase: SupabaseStorage) => {
        const driver = config.get<string>("storage.driver");
        if (driver === "s3") return s3;
        if (driver === "supabase") return supabase;
        return local;
      },
      inject: [ConfigService, LocalDiskStorage, S3Storage, SupabaseStorage],
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
