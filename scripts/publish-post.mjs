#!/usr/bin/env node

/**
 * Obsidian 筆記自動上架腳本
 *
 * 使用方式：
 *   npm run publish -- "<筆記路徑>"
 *   node scripts/publish-post.mjs "<筆記路徑>"
 *
 * 流程：
 *   1. 讀取 Obsidian markdown 筆記
 *   2. 互動式輸入 title / description / tags / slug / pubDate（description 必填）
 *   3. （可選）從最新的 origin/main 開一個新分支
 *   4. 清理內容：移除開頭重複的 H1 標題、還原被跳脫的標題（\#\# → ##）
 *   5. 把 ![[image.png]] / ![[image.png|300]] 的圖片複製到 src/assets/blog/<slug>/（build 時由 Astro 自動最佳化成 WebP）
 *   6. 寫入 src/content/blog/<slug>.md
 *   7. （可選）commit、push，並用 gh 建立 Pull Request
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { readFile, copyFile, writeFile, access, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const BLOG_DIR = join(PROJECT_ROOT, 'src', 'content', 'blog');
const ASSETS_BLOG_DIR = join(PROJECT_ROOT, 'src', 'assets', 'blog');
const REPO_URL = 'https://github.com/Cindragon/Cindragon.github.io';

// ── helpers ──────────────────────────────────────────────

const rl = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY });
// 用逐行讀取取代 rl.question()，在終端機和管線輸入（例如自動化測試）下都能正常運作
const lines = rl[Symbol.asyncIterator]();

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  rl.close();
  exit(1);
}

async function ask(question, defaultValue = '') {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  stdout.write(`${question}${suffix}: `);
  const { value, done } = await lines.next();
  if (done) fail('輸入已結束，流程中止');
  if (!stdin.isTTY) stdout.write(`${value}\n`);
  return value.trim() || defaultValue;
}

/** 重複詢問直到輸入通過驗證 */
async function askValid(question, validate, defaultValue = '') {
  for (;;) {
    const value = await ask(question, defaultValue);
    const error = validate(value);
    if (!error) return value;
    console.log(`   ⚠️  ${error}`);
  }
}

async function askYesNo(question, defaultYes = true) {
  const answer = await ask(`${question} (y/n)`, defaultYes ? 'y' : 'n');
  return answer.toLowerCase().startsWith('y');
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 執行指令（參數用陣列傳入，不經過 shell，標題含引號也不會出錯） */
function run(cmd, args, { capture = false } = {}) {
  return execFileSync(cmd, args, {
    cwd: PROJECT_ROOT,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf-8',
  });
}

function git(...args) {
  return run('git', args);
}

function gitOutput(...args) {
  return run('git', args, { capture: true }).trim();
}

function hasCommand(cmd) {
  try {
    run(cmd, ['--version'], { capture: true });
    return true;
  } catch {
    return false;
  }
}

/** 標題 → 預設 slug（只保留英數字） */
function toSlug(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60)
    .replace(/-+$/, '');
}

/** 圖片原始檔名 → 乾淨的檔名 */
function cleanImageName(raw) {
  return raw
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

/** 產生 YAML 安全的字串（JSON 字串也是合法的 YAML 字串） */
const yamlString = (s) => JSON.stringify(s);

/**
 * 清理 Obsidian 匯出內容：
 *  - 移除開頭空行
 *  - 移除開頭的 H1（版面已經會顯示 title，避免重複）
 *  - 還原被跳脫的標題：「\#\#\# 標題」→「### 標題」、「\#\#3. 標題」→「## 3. 標題」
 */
function cleanContent(raw) {
  let content = raw.replace(/\r\n/g, '\n').replace(/^\s*\n/, '');

  content = content.replace(/^((?:\\#)+)[ \t]*(\d+\.)?[ \t]*/gm, (_, hashes, num) => {
    const level = '#'.repeat(hashes.length / 2);
    return `${level} ${num ? `${num} ` : ''}`;
  });

  content = content.replace(/^# [^\n]*\n+/, '');

  return content;
}

// ── main ─────────────────────────────────────────────────

async function main() {
  const notePath = argv[2];
  if (!notePath) {
    fail('請提供 Obsidian 筆記路徑\n   用法: npm run publish -- "<筆記路徑>"');
  }

  const absNotePath = resolve(notePath);
  if (!(await fileExists(absNotePath))) {
    fail(`找不到檔案: ${absNotePath}`);
  }

  const noteDir = dirname(absNotePath);
  const rawContent = await readFile(absNotePath, 'utf-8');

  console.log('\n📝 讀取筆記完成，開始設定文章資訊...\n');

  // ── 互動式輸入 ────────────────────────────────────────

  const title = await askValid('文章標題 (title)', (v) => (v ? null : '標題不能是空的'));
  const description = await askValid('文章描述 (description，會顯示在列表與搜尋結果)', (v) =>
    v ? null : 'description 不能是空的'
  );
  const tagsRaw = await ask('標籤 (以逗號分隔，如 System Design, Backend)');
  const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean);

  const slug = await askValid(
    '文章 slug (網址路徑，只能用小寫英數字和 -)',
    (v) => (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? null : 'slug 格式不正確，例如 system-design-ch4'),
    toSlug(title)
  );

  const today = new Date().toLocaleDateString('sv-SE'); // 本地時區的 YYYY-MM-DD（toISOString 是 UTC，台灣早上會差一天）
  const pubDate = await askValid(
    '發布日期 (YYYY-MM-DD)',
    (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? null : '日期格式應為 YYYY-MM-DD'),
    today
  );

  const outputPath = join(BLOG_DIR, `${slug}.md`);
  if (await fileExists(outputPath)) {
    const overwrite = await askYesNo(`⚠️  src/content/blog/${slug}.md 已存在，要覆蓋嗎？`, false);
    if (!overwrite) fail('已取消，沒有寫入任何檔案');
  }

  // ── Git：先從最新的 main 開分支，再寫檔案 ──────────────

  const doGit = await askYesNo('\n要自動建立分支、commit、push 並開 Pull Request 嗎？');
  const branchName = `add-blog-${slug}`;

  if (doGit) {
    if (gitOutput('status', '--porcelain')) {
      fail('工作目錄有尚未 commit 的變更，請先 commit 或 stash 後再執行（或選 n 只產生檔案）');
    }
    if (gitOutput('branch', '--list', branchName)) {
      fail(`分支 ${branchName} 已存在，請換一個 slug 或先刪除該分支`);
    }

    console.log('\n🔄 取得最新的 origin/main...');
    git('fetch', 'origin', 'main');
    console.log(`🔀 從 origin/main 建立分支: ${branchName}`);
    git('switch', '-c', branchName, '--no-track', 'origin/main');
  }

  // ── 處理圖片 ──────────────────────────────────────────
  // 支援 ![[image.png]] 與 ![[image.png|300]]；圖片放到 src/assets/blog/<slug>/：避免不同文章撞名，且 build 時會自動最佳化

  const imageRegex = /!\[\[([^\]|]+\.(?:png|jpe?g|gif|svg|webp))(?:\|[^\]]*)?\]\]/gi;
  const imageMatches = [...rawContent.matchAll(imageRegex)];
  const imageMap = new Map(); // obsidian name -> web path (null = 找不到)
  const imageDir = join(ASSETS_BLOG_DIR, slug);

  if (imageMatches.length > 0) {
    console.log(`\n🖼️  偵測到 ${imageMatches.length} 張圖片，開始處理...\n`);
    await mkdir(imageDir, { recursive: true });

    for (const [, obsidianName] of imageMatches) {
      if (imageMap.has(obsidianName)) continue;

      const candidates = [join(noteDir, obsidianName), join(noteDir, 'attachments', obsidianName)];
      let srcPath = null;
      for (const c of candidates) {
        if (await fileExists(c)) {
          srcPath = c;
          break;
        }
      }

      if (!srcPath) {
        console.warn(`   ⚠️  找不到圖片: ${obsidianName}，跳過`);
        imageMap.set(obsidianName, null);
        continue;
      }

      const fileName = cleanImageName(obsidianName);
      // 文章在 src/content/blog/，用相對路徑引用 src/assets/blog/<slug>/ 的圖片
      const webPath = `../../assets/blog/${slug}/${fileName}`;
      await copyFile(srcPath, join(imageDir, fileName));
      imageMap.set(obsidianName, webPath);
      console.log(`   ✅ ${obsidianName} → src/assets/blog/${slug}/${fileName}`);
    }
  }

  // ── 轉換內容 ──────────────────────────────────────────

  let content = rawContent.replace(imageRegex, (_, name) => {
    const webPath = imageMap.get(name);
    if (!webPath) return `<!-- 圖片遺失: ${name} -->`;
    const alt = name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    return `![${alt}](${webPath})`;
  });
  content = cleanContent(content);

  const frontmatter = [
    '---',
    `title: ${yamlString(title)}`,
    `description: ${yamlString(description)}`,
    `pubDate: ${pubDate}`,
    `tags: [${tags.map(yamlString).join(', ')}]`,
    '---',
    '',
  ].join('\n');

  await writeFile(outputPath, frontmatter + content, 'utf-8');
  console.log(`\n✅ 文章已建立: src/content/blog/${slug}.md`);

  // ── Git：commit、push、開 PR ──────────────────────────

  if (doGit) {
    try {
      console.log('\n📦 加入變更...');
      git('add', '--', `src/content/blog/${slug}.md`);
      if ([...imageMap.values()].some(Boolean)) {
        git('add', '--', `src/assets/blog/${slug}`);
      }

      git('commit', '-m', `Add blog post: ${title}`);

      console.log('🚀 推送到遠端...');
      git('push', '-u', 'origin', branchName);
    } catch (err) {
      console.error('\n❌ Git 操作失敗:', err.message);
      console.log('   文章已寫入，請手動完成 commit / push');
      rl.close();
      return;
    }

    if (hasCommand('gh')) {
      try {
        console.log('\n📬 建立 Pull Request...');
        run('gh', [
          'pr', 'create',
          '--base', 'main',
          '--head', branchName,
          '--title', `Add blog post: ${title}`,
          '--body', `新增文章：**${title}**\n\n${description}`,
        ]);
      } catch {
        console.log(`\n⚠️  自動建立 PR 失敗，請到這裡手動建立：\n   ${REPO_URL}/compare/main...${branchName}?expand=1`);
      }
    } else {
      console.log(`\n🎉 已 push！請到這裡建立 PR：\n   ${REPO_URL}/compare/main...${branchName}?expand=1`);
    }
  }

  console.log('\n✨ 文章上架流程完成！\n');
  rl.close();
}

main().catch((err) => {
  console.error('❌ 發生錯誤:', err);
  rl.close();
  exit(1);
});
