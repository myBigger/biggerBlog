import { defineConfig, envField, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./src/utils/transformers/fileName";
import { SITE } from "./src/config";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  integrations: [
    sitemap({
      filter: page => SITE.showArchives || !page.endsWith("/archives"),
    }),
  ],
  markdown: {
    remarkPlugins: [remarkToc, [remarkCollapse, { test: "Table of contents" }]],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerFileName({ style: "v2", hideDot: false }),
        transformerNotationHighlight(),
        transformerNotationWordHighlight(),
        transformerNotationDiff({ matchAlgorithm: "v3" }),
      ],
    },
  },
  vite: {
    // eslint-disable-next-line
    // @ts-ignore
    // This will be fixed in Astro 6 with Vite 7 support
    // See: https://github.com/withastro/astro/issues/14030
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
    },
  },
  experimental: {
    preserveScriptOrder: true,
    fonts: [
      // GitHub 风格中文字体（Noto Sans，含简繁体中文）
      {
        name: "Noto Sans",
        cssVariable: "--font-sans",
        provider: fontProviders.google(),
        fallbacks: ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Helvetica", "Arial", "sans-serif"],
        weights: [300, 400, 500, 600, 700, 800, 900],
        styles: ["normal", "italic"],
        subsets: ["latin", "latin-ext", "chinese-simplified", "chinese-traditional"],
      },
      // GitHub 风格等宽字体（Geist Mono）
      {
        name: "Geist Mono",
        cssVariable: "--font-mono",
        provider: fontProviders.google(),
        fallbacks: ["ui-monospace", "'SFMono-Regular'", "'SF Mono'", "Menlo", "Consolas", "'Liberation Mono'", "monospace"],
        weights: [300, 400, 500, 600, 700, 800, 900],
        styles: ["normal", "italic"],
        subsets: ["latin", "latin-ext"],
      },
    ],
  },
});
