import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server bundle (.next/standalone) carrying only the
  // dependencies actually traced from the build — the standard base for a production Docker
  // image (see apps/web/Dockerfile) instead of shipping the full node_modules tree.
  output: "standalone",
  // packages/ui, packages/types, and packages/config (its brand.ts, added Phase 15 — previously
  // this package only exported non-JS files) are workspace TS sources, not pre-built — Next.js
  // needs to transpile them itself rather than expecting compiled JS in node_modules.
  transpilePackages: ["@sofsavdo/ui", "@sofsavdo/types", "@sofsavdo/config"],
  // The enclosing directory tree has an unrelated git repo (and its own package-lock.json)
  // several levels up — pin the workspace root explicitly so Next.js never infers it and
  // never traces/watches files outside this project. See PROJECT_STATUS.md "Repository
  // isolation".
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
