#!/usr/bin/env node

/**
 * Obsidian 筆記自動上架腳本
 *
 * 使用方式：
 *   node scripts/publish-post.mjs "<筆記路徑>"
 *
 * 範例：
 *   node scripts/publish-post.mjs "C:\Users\User\Desktop\Jerry\Obsidian 筆記\System Design Interview By Alex Wu - Chapter 1 Part 3.md"
 *
 * 功能：
 *   1. 讀取 Obsidian markdown 筆記
 *   2. 互動式輸入 title / description / tags / slug / pubDate
 *   3. 自動偵測 ![[image.png]] 語法，從筆記同目錄複製圖片到 public/blog/
 *   4. 轉換為 Astro blog 格式並寫入 src/content/blog/
 *   5. 可選擇自動建立 git branch、commit 並 push
 */

import { createInterface } from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { readFile, copyFile, writeFile, access } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const BLOG_DIR = join(PROJECT_ROOT, 'src', 'content', 'blog');
const PUBLIC_BLOG_DIR = join(PROJECT_ROOT, 'public', 'blog');

// ── helpers ──────────────────────────────────────────────

const rl = createInterface({ input: stdin, output: stdout });

async function ask(question, defaultValue = '') {
  const suffix = defaultValue ? ` (${defaultValue})` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || defaultValue;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** 將檔名轉為 URL-safe 的 kebab-case */
function toKebab(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

/** 將圖片原始檔名轉為乾淨的 slug */
function cleanImageName(raw) {
  return raw
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
}

// ── main ─────────────────────────────────────────────────

async function main() {
  const notePath = argv[2];

  if (!notePath) {
    console.error('\n❌ 請提供 Obsidian 筆記路徑');
    console.error('   用法: node scripts/publish-post.mjs "<筆記路徑>"\n');
    exit(1);
  }

  const absNotePath = resolve(notePath);
  if (!(await fileExists(absNotePath))) {
    console.error(`\n❌ 找不到檔案: ${absNotePath}\n`);
    exit(1);
  }

  const noteDir = dirname(absNotePath);
  const rawContent = await readFile(absNotePath, 'utf-8');

  console.log('\n📝 讀取筆記完成，開始設定文章資訊...\n');

  // ── 互動式輸入 ────────────────────────────────────────

  const title = await ask('文章標題 (title)');
  const description = await ask('文章描述 (description)');
  const tagsRaw = await ask('標籤 (以逗號分隔，如 System Design, Backend)');
  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

  const defaultSlug = toKebab(title.replace(/[^\w\s-]/g, '').substring(0, 60));
  const slug = await ask('文章 slug (網址路徑)', defaultSlug);

  const today = new Date().toISOString().slice(0, 10);
  const pubDate = await ask('發布日期 (YYYY-MM-DD)', today);

  // ── 處理圖片 ──────────────────────────────────────────

  const imageRegex = /!\[\[([^\]]+\.(?:png|jpg|jpeg|gif|svg|webp))\]\]/gi;
  const imageMatches = [...rawContent.matchAll(imageRegex)];
  const imageMap = new Map(); // obsidian name -> new web path

  if (imageMatches.length > 0) {
    console.log(`\n🖼️  偵測到 ${imageMatches.length} 張圖片，開始處理...\n`);

    for (const match of imageMatches) {
      const obsidianName = match[1];
      if (imageMap.has(obsidianName)) continue;

      const srcPath = join(noteDir, obsidianName);
      if (!(await fileExists(srcPath))) {
        console.warn(`   ⚠️  找不到圖片: ${obsidianName}，跳過`);
        imageMap.set(obsidianName, null);
        continue;
      }

      const cleanName = cleanImageName(obsidianName);
      const destPath = join(PUBLIC_BLOG_DIR, cleanName);
      await copyFile(srcPath, destPath);
      imageMap.set(obsidianName, `/blog/${cleanName}`);
      console.log(`   ✅ ${obsidianName} → /blog/${cleanName}`);
    }
  }

  // ── 轉換內容 ──────────────────────────────────────────

  let content = rawContent;

  // 移除開頭空行
  content = content.replace(/^\s*\n/, '');

  // 轉換 Obsidian 圖片語法為標準 Markdown
  content = content.replace(imageRegex, (_, name) => {
    const webPath = imageMap.get(name);
    if (!webPath) return `<!-- 圖片遺失: ${name} -->`;
    const alt = name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
    return `![${alt}](/blog/${cleanImageName(name)})`;
  });

  // 組合 frontmatter
  const tagsStr = tags.map(t => `"${t}"`).join(', ');
  const frontmatter = [
    '---',
    `title: "${title}"`,
    `description: "${description}"`,
    `pubDate: ${pubDate}`,
    `tags: [${tagsStr}]`,
    '---',
    '',
  ].join('\n');

  const finalContent = frontmatter + content;

  // ── 寫入檔案 ──────────────────────────────────────────

  const outputPath = join(BLOG_DIR, `${slug}.md`);
  await writeFile(outputPath, finalContent, 'utf-8');
  console.log(`\n✅ 文章已建立: src/content/blog/${slug}.md`);

  // ── Git 操作（可選）────────────────────────────────────

  const doGit = await ask('\n要自動建立 git branch 並 push 嗎？(y/n)', 'y');

  if (doGit.toLowerCase() === 'y') {
    const branchName = `add-blog-${slug}`;

    try {
      console.log(`\n🔀 建立分支: ${branchName}`);
      execSync(`git checkout -b ${branchName}`, { cwd: PROJECT_ROOT, stdio: 'inherit' });

      console.log('📦 加入變更...');
      execSync(`git add "src/content/blog/${slug}.md"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });

      // 加入所有新圖片
      for (const [, webPath] of imageMap) {
        if (webPath) {
          const relativePath = `public${webPath}`;
          execSync(`git add "${relativePath}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });
        }
      }

      const commitMsg = `Add blog post: ${title}`;
      execSync(`git commit -m "${commitMsg}"`, { cwd: PROJECT_ROOT, stdio: 'inherit' });

      console.log('🚀 推送到遠端...');
      execSync(`git push -u origin ${branchName}`, { cwd: PROJECT_ROOT, stdio: 'inherit' });

      console.log(`\n🎉 完成！請到 GitHub 建立 PR 來 merge 到 main`);
      console.log(`   https://github.com/Cindragon/Cindragon.github.io/compare/main...${branchName}`);
    } catch (err) {
      console.error('\n❌ Git 操作失敗:', err.message);
      console.log('   文章已寫入，請手動進行 git 操作');
    }
  }

  console.log('\n✨ 文章上架流程完成！\n');
  rl.close();
}

main().catch(err => {
  console.error('❌ 發生錯誤:', err);
  rl.close();
  exit(1);
});
