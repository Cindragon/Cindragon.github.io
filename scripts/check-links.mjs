#!/usr/bin/env node
/**
 * 檢查 build 出來的網站（dist/）裡所有站內連結是否有效：
 *  - <a href>、<link href>、<img src / srcset>、<script src>、<meta content>（og:image 等）
 *  - 指向站內的路徑必須對應到 dist/ 裡的檔案（/blog/ → dist/blog/index.html）
 *  - 頁內錨點（#標題）必須在目標頁面找得到對應的 id
 * 站外連結不檢查（避免 CI 因為別人的網站暫時掛掉而失敗）。
 *
 * 用法：npm run build && npm run check:links
 */
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SITE = 'https://cindragon.github.io';
/**
 * 同一個網域下、但屬於其他 repo 的 GitHub Pages 專案網站，不在這個 dist/ 裡，當成站外連結。
 * 新增其他專案網站連結時，把路徑前綴加在這裡。
 */
const OTHER_PROJECT_SITES = ['/Leetcode-Practice-Grind-75/'];

if (!existsSync(dist)) {
  console.error('❌ 找不到 dist/，請先執行 npm run build');
  process.exit(1);
}

/** 遞迴列出所有 .html */
function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = join(dir, d.name);
    return d.isDirectory() ? htmlFiles(p) : d.name.endsWith('.html') ? [p] : [];
  });
}

/** 檔案路徑 → 網址路徑（dist/blog/index.html → /blog/） */
function pageUrl(file) {
  const rel = '/' + relative(dist, file).split(sep).join('/');
  return rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
}

/** 網址路徑 → dist 裡的檔案；找不到回傳 null */
function resolveFile(pathname) {
  let p = decodeURIComponent(pathname);
  const candidates = p.endsWith('/') ? [p + 'index.html'] : [p, p + '/index.html', p + '.html'];
  for (const c of candidates) {
    const f = join(dist, ...c.split('/'));
    if (existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}

const idCache = new Map();
function idsOf(file) {
  if (!idCache.has(file)) {
    const html = readFileSync(file, 'utf8');
    idCache.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => decodeHtml(m[1]))));
  }
  return idCache.get(file);
}

const decodeHtml = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** 從 HTML 取出要檢查的網址 */
function extractUrls(html) {
  const urls = [];
  // 跳過 <script> 內容，避免把 JS 字串當成連結
  const body = html.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, '');
  for (const m of body.matchAll(/<(a|link|img|script|source)\b[^>]*>/gi)) {
    const tag = m[0];
    for (const attr of ['href', 'src']) {
      const v = tag.match(new RegExp(`\\s${attr}="([^"]*)"`, 'i'))?.[1];
      if (v !== undefined) urls.push(decodeHtml(v));
    }
    const srcset = tag.match(/\ssrcset="([^"]*)"/i)?.[1];
    if (srcset) urls.push(...decodeHtml(srcset).split(',').map((s) => s.trim().split(/\s+/)[0]).filter(Boolean));
  }
  for (const m of body.matchAll(/<meta\b[^>]*\b(?:property|name)="(?:og:image|og:url|twitter:image)"[^>]*>/gi)) {
    const v = m[0].match(/\scontent="([^"]*)"/i)?.[1];
    if (v) urls.push(decodeHtml(v));
  }
  return urls;
}

const problems = [];
const files = htmlFiles(dist);
let checked = 0;

for (const file of files) {
  const from = pageUrl(file);
  const html = readFileSync(file, 'utf8');
  for (const raw of extractUrls(html)) {
    if (!raw || /^(mailto:|tel:|javascript:|data:)/i.test(raw)) continue;

    let url;
    try {
      url = new URL(raw, SITE + from);
    } catch {
      problems.push(`${from} → 無效的網址 "${raw}"`);
      continue;
    }
    if (url.origin !== SITE) continue; // 站外連結不檢查
    if (OTHER_PROJECT_SITES.some((p) => url.pathname.startsWith(p))) continue;

    checked++;
    const target = resolveFile(url.pathname);
    if (!target) {
      problems.push(`${from} → ${url.pathname}（找不到頁面或檔案）`);
      continue;
    }
    if (url.hash.length > 1 && target.endsWith('.html')) {
      const id = decodeURIComponent(url.hash.slice(1));
      if (!idsOf(target).has(id)) problems.push(`${from} → ${url.pathname}${url.hash}（找不到這個錨點）`);
    }
  }
}

if (problems.length) {
  const unique = [...new Set(problems)];
  console.error(`❌ 連結檢查失敗（${unique.length} 個問題，共檢查 ${files.length} 頁）：`);
  for (const p of unique) console.error(`   - ${p}`);
  process.exit(1);
}
console.log(`✅ 連結檢查通過：${files.length} 頁、${checked} 個站內連結都有效`);
