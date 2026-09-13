// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { site } from "./src/site.config.ts";
import { sajuAdminApi } from "./saju-admin-api.mjs";

export default defineConfig({
  site: site.baseUrl,
  output: "static",
  trailingSlash: "always",
  integrations: [
    sajuAdminApi(),
    sitemap({
      filter: (page) =>
        !page.includes("/404") && !page.includes("/admin") && !page.includes("/rss"),
    }),
  ],
  build: {
    inlineStylesheets: "always",
  },
  image: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-4d97094276754b65903a7f773113ed64.r2.dev",
      },
    ],
  },
});
