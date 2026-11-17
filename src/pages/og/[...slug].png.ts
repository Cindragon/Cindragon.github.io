import type { APIRoute, GetStaticPaths } from 'astro';
import { getPublishedPosts, formatDate, type Post } from '../../utils/posts';
import { renderOgImage } from '../../utils/og-image';

/** 每篇文章一張預覽圖：/og/<slug>.png；另外 /og/site.png 給首頁與列表頁用 */
export const getStaticPaths = (async () => {
  const posts = await getPublishedPosts();
  return [
    ...posts.map((post) => ({ params: { slug: post.id }, props: { post } })),
    { params: { slug: 'site' }, props: { post: undefined } },
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ post?: Post }> = async ({ props }) => {
  const { post } = props;

  const png = post
    ? await renderOgImage({
        title: post.data.title,
        eyebrow: post.data.series ?? 'Blog',
        meta: formatDate(post.data.pubDate, 'long'),
        tags: post.data.tags,
      })
    : await renderOgImage({
        title: 'Jerry Tsai · 蔡鎮鴻',
        eyebrow: 'Firmware Engineer · Algorithm Enthusiast',
        tags: ['Firmware', 'Algorithms', 'System Design'],
      });

  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
