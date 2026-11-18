// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import rehypeImageSizes from './src/utils/rehype-image-sizes.mjs';

export default defineConfig({
  site: 'https://cindragon.github.io',
  integrations: [
    sitemap({
      // 英文頁在根目錄、中文頁在 /zh/；sitemap 會為兩個版本互相標註 hreflang
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', zh: 'zh-TW' },
      },
    }),
  ],
  image: {
    // 文章圖片產生多種寬度的 srcset，手機只下載需要的尺寸；不會放大超過原圖
    layout: 'constrained',
    responsiveStyles: true,
  },
  markdown: {
    // Astro 7 預設改用 Sätteri；我們需要 rehype 外掛，所以明確使用 unified（remark/rehype）處理器
    processor: unified({
      rehypePlugins: [rehypeImageSizes],
    }),
    shikiConfig: {
      // 淺色預設 github-light；深色模式由 global.css 切到 --shiki-dark 變數（github-dark）
      themes: { light: 'github-light', dark: 'github-dark' },
    },
  },
});
