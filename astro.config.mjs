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
      filter: (page) => !page.includes("/404") && !page.includes("/admin"),
    }),
  ],
  build: {
    inlineStylesheets: "always",
  },
});
