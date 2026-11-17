// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import rehypeImageSizes from './src/utils/rehype-image-sizes.mjs';

export default defineConfig({
  site: 'https://cindragon.github.io',
  integrations: [sitemap()],
  image: {
    // 文章圖片產生多種寬度的 srcset，手機只下載需要的尺寸；不會放大超過原圖
    layout: 'constrained',
    responsiveStyles: true,
  },
  markdown: {
    rehypePlugins: [rehypeImageSizes],
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
