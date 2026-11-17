import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'>;

/** 所有非草稿文章，依發布日期由新到舊排序 */
export async function getPublishedPosts(): Promise<Post[]> {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
}

/** 例：short → "Jul 22, 2026"、long → "July 22, 2026" */
export function formatDate(date: Date, month: 'short' | 'long' = 'short'): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month, day: 'numeric' });
}

const CJK = /[㐀-鿿豈-﫿]/g; // 只用於 match / replace
const HAS_CJK = /[㐀-鿿豈-﫿]/; // 不加 g，test() 才不會受 lastIndex 影響

/** 文章語言：frontmatter 有填就用，否則標題含中文視為 zh-TW */
export function getPostLang(post: Post): 'en' | 'zh-TW' {
  return post.data.lang ?? (HAS_CJK.test(post.data.title) ? 'zh-TW' : 'en');
}

/** 預估閱讀分鐘數：中文約每分鐘 400 字、英文約每分鐘 200 字 */
export function getReadingMinutes(body = ''): number {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ') // 程式碼區塊不計
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 圖片不計
    .replace(/<[^>]+>/g, ' ');
  const cjkChars = text.match(CJK)?.length ?? 0;
  const words = text.replace(CJK, ' ').match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return Math.max(1, Math.round(cjkChars / 400 + words / 200));
}

/** 標籤 → 網址用的 slug，例："System Design" → "system-design" */
export function tagToSlug(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

export function tagUrl(tag: string): string {
  return `/blog/tags/${tagToSlug(tag)}/`;
}

/** 所有標籤（以 slug 去重），附文章數，依數量排序 */
export function getAllTags(posts: Post[]): { tag: string; slug: string; count: number }[] {
  const map = new Map<string, { tag: string; slug: string; count: number }>();
  for (const post of posts) {
    for (const tag of post.data.tags) {
      const slug = tagToSlug(tag);
      const entry = map.get(slug) ?? { tag, slug, count: 0 };
      entry.count++;
      map.set(slug, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface SeriesNav {
  name: string;
  index: number; // 從 1 開始
  total: number;
  prev?: Post;
  next?: Post;
}

/** 同系列的上一篇／下一篇 */
export function getSeriesNav(posts: Post[], post: Post): SeriesNav | undefined {
  const { series } = post.data;
  if (!series) return undefined;
  const items = posts
    .filter((p) => p.data.series === series)
    .sort(
      (a, b) =>
        (a.data.seriesOrder ?? Infinity) - (b.data.seriesOrder ?? Infinity) ||
        a.data.pubDate.valueOf() - b.data.pubDate.valueOf()
    );
  const i = items.findIndex((p) => p.id === post.id);
  return { name: series, index: i + 1, total: items.length, prev: items[i - 1], next: items[i + 1] };
}
