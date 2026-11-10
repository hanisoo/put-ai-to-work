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
  experimental: {
    // __dirname 대신 path.resolve('.')를 사용해 현재 폴더 기준 상위 디렉토리를 지정합니다.
    outputFileTracingRoot: path.resolve(".", "../"),
  },
};

export default nextConfig;
