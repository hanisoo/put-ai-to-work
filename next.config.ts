import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // 1. experimental 내부에서 빼서 최상단(루트)에 바로 선언합니다.
  outputFileTracingRoot: path.resolve(".", "../"),
};

export default nextConfig;
