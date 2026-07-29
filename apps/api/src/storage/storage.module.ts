import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalDiskStorage } from "./local-disk.storage";
import { S3Storage } from "./s3.storage";
import { STORAGE_PORT } from "./storage.port";

// Global: every domain that needs to store a file (Campaign media today; avatar/content uploads
// later) injects STORAGE_PORT rather than importing a concrete adapter. Which concrete adapter
// backs it is env-driven (STORAGE_DRIVER=local|s3, see configuration.ts) — swapping providers is a
// deploy-time config change, never a code change in any domain module.
@Global()
@Module({
  providers: [
    LocalDiskStorage,
    S3Storage,
    {
      provide: STORAGE_PORT,
      useFactory: (config: ConfigService, local: LocalDiskStorage, s3: S3Storage) =>
        config.get<string>("storage.driver") === "s3" ? s3 : local,
      inject: [ConfigService, LocalDiskStorage, S3Storage],
    },
  ],
  exports: [STORAGE_PORT],
})
export class StorageModule {}
