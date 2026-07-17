import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/ui and packages/types are workspace TS sources, not pre-built — Next.js needs to
  // transpile them itself rather than expecting compiled JS in node_modules.
  transpilePackages: ["@rosti/ui", "@rosti/types"],
  // The enclosing directory tree has an unrelated git repo (and its own package-lock.json)
  // several levels up — pin the workspace root explicitly so Next.js never infers it and
  // never traces/watches files outside this project. See PROJECT_STATUS.md "Repository
  // isolation".
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
