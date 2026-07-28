import type { ErrorReportingPort } from "./error-reporting.port";

// The default when no external provider is configured. Phase 14 §7 requires the external
// error-reporting hook to be genuinely optional — startup, and every request, must work
// identically whether or not one is configured. Deliberately declares no parameters — TypeScript
// allows an implementation to accept fewer parameters than the interface it satisfies, and there
// is nothing to name here since neither is ever read.
export class NoopErrorReportingAdapter implements ErrorReportingPort {
  report(): void {
    // intentionally does nothing
  }
}
