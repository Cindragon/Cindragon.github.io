/**
 * 在 build 時產生社群分享用的預覽圖（Open Graph，1200×630 PNG）。
 *
 * - satori：把版面（類似 JSX 的物件）畫成 SVG
 * - sharp：把 SVG 轉成 PNG
 * - 字體：向 Google Fonts 只請求卡片上實際用到的字（text= 參數），
 *   拿到很小的 TrueType 子集，不用把好幾 MB 的中文字體放進 repo
 */
import satori from 'satori';
import sharp from 'sharp';

const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: '#ffffff',
  text: '#262626',
  textLight: '#6b6b6b',
  teal: '#0085a1',
  tealDim: 'rgba(0, 133, 161, 0.1)',
  tealBorder: 'rgba(0, 133, 161, 0.35)',
  border: '#eaeaea',
};

type Weight = 400 | 700;

const fontCache = new Map<string, Promise<ArrayBuffer>>();

/** 只下載 text 裡出現的字元的字體子集 */
function loadFont(text: string, weight: Weight): Promise<ArrayBuffer> {
  const chars = [...new Set(text)].join('');
  const key = `${weight}:${chars}`;
  if (!fontCache.has(key)) {
    fontCache.set(
      key,
      (async () => {
        const cssUrl =
          `https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@${weight}` +
          `&text=${encodeURIComponent(chars)}`;
        const css = await (await fetch(cssUrl)).text();
        const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
        if (!fontUrl) throw new Error(`OG image: Google Fonts did not return a TrueType font (${weight})`);
        const res = await fetch(fontUrl);
        if (!res.ok) throw new Error(`OG image: font download failed (${res.status})`);
        return res.arrayBuffer();
      })()
    );
  }
  return fontCache.get(key)!;
}

// satori 接受 { type, props } 物件，等同 JSX，不需要 React
type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

export interface OgCardOptions {
  /** 大標題 */
  title: string;
  /** 標題上方的小標，例如系列名稱 */
  eyebrow?: string;
  /** 底部左側資訊，例如日期 */
  meta?: string;
  tags?: string[];
}

export async function renderOgImage({ title, eyebrow = 'Blog', meta, tags = [] }: OgCardOptions): Promise<Buffer> {
  const shownTags = tags.slice(0, 4);
  const site = 'cindragon.github.io';
  const brand = 'Jerry Tsai';

  // 標題越長字越小，避免超出卡片
  const titleSize = title.length > 40 ? 52 : title.length > 26 ? 60 : 68;

  const root = h(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      backgroundColor: COLORS.bg,
      fontFamily: 'Noto Sans TC',
    },
    [
      // 左側品牌色條
      h('div', { width: 20, height: '100%', backgroundColor: COLORS.teal }),
      h(
        'div',
        {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px 56px 72px',
        },
        [
          h('div', { display: 'flex', flexDirection: 'column' }, [
            h(
              'div',
              { fontSize: 28, fontWeight: 700, color: COLORS.teal, letterSpacing: 1, marginBottom: 28 },
              eyebrow
            ),
            h(
              'div',
              { fontSize: titleSize, fontWeight: 700, color: COLORS.text, lineHeight: 1.3 },
              title
            ),
          ]),
          h('div', { display: 'flex', flexDirection: 'column' }, [
            shownTags.length > 0 &&
              h(
                'div',
                { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
                shownTags.map((tag) =>
                  h(
                    'div',
                    {
                      fontSize: 22,
                      fontWeight: 700,
                      color: COLORS.teal,
                      backgroundColor: COLORS.tealDim,
                      border: `2px solid ${COLORS.tealBorder}`,
                      borderRadius: 4,
                      padding: '4px 14px',
                    },
                    tag
                  )
                )
              ),
            h(
              'div',
              {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: `2px solid ${COLORS.border}`,
                paddingTop: 28,
                fontSize: 26,
                color: COLORS.textLight,
              },
              [
                h('div', { display: 'flex', fontWeight: 700, color: COLORS.text }, brand),
                h('div', { display: 'flex' }, [meta ? `${meta}  ·  ${site}` : site].join('')),
              ]
            ),
          ].filter(Boolean)),
        ]
      ),
    ]
  );

  const allText = [title, eyebrow, meta ?? '', site, brand, '·', ...shownTags].join('');
  const [regular, bold] = await Promise.all([loadFont(allText, 400), loadFont(allText, 700)]);

  const svg = await satori(root as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: 'Noto Sans TC', data: regular, weight: 400, style: 'normal' },
      { name: 'Noto Sans TC', data: bold, weight: 700, style: 'normal' },
    ],
  });

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
