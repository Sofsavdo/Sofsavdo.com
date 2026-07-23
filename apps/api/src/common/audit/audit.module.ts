import { Global, Module } from "@nestjs/common";
import { AuditService } from "./audit.service";

// Global for the same reason StorageModule is: any domain that needs to record an audit event
// injects AuditService directly, no per-module import wiring required.
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
