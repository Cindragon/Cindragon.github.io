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
