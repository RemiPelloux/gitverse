import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=1 builds a fully static site into `out/` (used for GitHub Pages).
 * BASE_PATH sets the sub-path it is served from, e.g. "/gitverse".
 * Gitverse runs entirely in the browser, so the static build is the whole app.
 */
const staticExport = process.env.STATIC_EXPORT === "1";
const basePath = process.env.BASE_PATH || undefined;

const nextConfig: NextConfig = {
  ...(staticExport ? { output: "export" as const, trailingSlash: true, images: { unoptimized: true } } : {}),
  basePath,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
