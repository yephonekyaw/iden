import type { NextConfig } from "next";

const config: NextConfig = {
  // Traces the files the server actually imports and emits one with its own
  // node_modules, so the container image needs neither pnpm nor the build
  // dependencies. Only read by `next build`; `pnpm dev` is unaffected.
  output: "standalone",
};

export default config;
