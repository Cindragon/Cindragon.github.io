import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    /** 文章內容語言；沒填時依標題是否含中文自動判斷 */
    lang: z.enum(['en', 'zh-TW']).optional(),
    /** 系列文章名稱與順序，用來顯示「上一篇／下一篇」 */
    series: z.string().optional(),
    seriesOrder: z.number().int().positive().optional(),
  }),
});

export const collections = { blog };
