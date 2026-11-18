#!/usr/bin/env node
/**
 * 檢查 src/i18n/en.ts 和 src/i18n/zh.ts 的翻譯 key 是否一致，以及有沒有空字串。
 * 用法：npm run check:i18n
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

/** 從翻譯檔讀出 { key: value }（每行格式為  'key': 'value',） */
function readKeys(lang) {
  const text = readFileSync(join(root, 'src', 'i18n', `${lang}.ts`), 'utf8');
  const entries = new Map();
  const duplicates = [];
  let parsed = 0;
  for (const m of text.matchAll(/^\s*'([^']+)'\s*:\s*(['"`])(.*)\2\s*,?\s*$/gm)) {
    parsed++;
    if (entries.has(m[1])) duplicates.push(m[1]);
    entries.set(m[1], m[3]);
  }
  // 以 ' 開頭的行都應該是翻譯；數量對不上代表有某行格式讀不懂，避免漏檢
  const keyLines = text.match(/^\s*'[^']+'\s*:/gm)?.length ?? 0;
  if (keyLines !== parsed) {
    problems.push(`${lang}.ts 有 ${keyLines - parsed} 行無法解析（請用單行 'key': 'value', 格式）`);
  }
  return { entries, duplicates };
}

const en = readKeys('en');
const zh = readKeys('zh');

for (const key of en.entries.keys()) if (!zh.entries.has(key)) problems.push(`zh.ts 缺少 '${key}'`);
for (const key of zh.entries.keys()) if (!en.entries.has(key)) problems.push(`en.ts 缺少 '${key}'`);
for (const [lang, { entries, duplicates }] of [['en', en], ['zh', zh]]) {
  for (const key of duplicates) problems.push(`${lang}.ts 重複的 key '${key}'`);
  for (const [key, value] of entries) if (!value.trim()) problems.push(`${lang}.ts 的 '${key}' 是空字串`);
}

if (en.entries.size === 0) problems.push('讀不到任何翻譯 key，請確認 en.ts 的格式');

if (problems.length) {
  console.error(`❌ 翻譯檢查失敗（${problems.length} 個問題）：`);
  for (const p of problems) console.error(`   - ${p}`);
  process.exit(1);
}
console.log(`✅ 翻譯檢查通過：en / zh 各 ${en.entries.size} 個 key，內容一致`);
