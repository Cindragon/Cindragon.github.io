// 一次性腳本：產生網站圖示（favicon.svg / favicon.ico / apple-touch-icon.png）
// 用 satori 把「JT」畫成向量路徑（不依賴使用者電腦的字體），再用 sharp 轉 PNG。
// 用法：node scripts/gen-icons.mjs
import satori from 'satori';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

const TEAL = '#0085a1';
const css = await (await fetch(
  'https://fonts.googleapis.com/css2?family=Open+Sans:wght@700&text=JT'
)).text();
const fontUrl = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
if (!fontUrl) throw new Error('Google Fonts did not return a TrueType font');
const font = await (await fetch(fontUrl)).arrayBuffer();

const render = (radius) => satori(
  {
    type: 'div',
    props: {
      style: {
        width: 128, height: 128, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: TEAL, borderRadius: radius, color: '#fff', fontSize: 64, fontWeight: 700,
        letterSpacing: -2,
      },
      children: 'JT',
    },
  },
  { width: 128, height: 128, fonts: [{ name: 'Open Sans', data: font, weight: 700 }] }
);
const svg = await render(28);
await writeFile('public/favicon.svg', svg + '\n');

// apple-touch-icon：iOS 會自己加圓角，所以用不透明的方形底
const square = await render(0);
await sharp(Buffer.from(square)).resize(180, 180).png().toFile('public/apple-touch-icon.png');

// favicon.ico：ICO 檔可直接內嵌 PNG（32×32）
const png32 = await sharp(Buffer.from(svg)).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
await writeFile('public/favicon.ico', Buffer.concat([header, png32]));
console.log('icons written');
