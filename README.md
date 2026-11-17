# Jerry Tsai — Personal Portfolio & Blog

個人作品集與技術部落格，使用 [Astro](https://astro.build) 建置的純靜態網站，部署在 GitHub Pages：<https://cindragon.github.io>

## 網站內容

- **個人作品集**：經歷、專案、技能與證照
- **技術部落格**：系統設計、演算法、韌體開發等文章
- **中英雙語**：英文版在 `/`，繁體中文版在 `/zh/`，兩個版本都在 build 時產生，搜尋引擎都能收錄

## 技術棧

| 技術 | 用途 |
| :--- | :--- |
| [Astro](https://astro.build) 7 | 靜態網站框架、檔案路由、Content Collections |
| TypeScript | 型別安全的 i18n、文章工具函式與腳本 |
| `@astrojs/markdown-remark` | Markdown 處理（unified / rehype 外掛） |
| `astro:assets` + sharp | 文章圖片自動轉 WebP、產生多尺寸 srcset、延遲載入 |
| [satori](https://github.com/vercel/satori) + sharp | build 時為每篇文章產生分享預覽圖（Open Graph 標題卡片） |
| `@astrojs/sitemap` / `@astrojs/rss` | sitemap（含中英 hreflang）與 RSS 訂閱 |
| [Giscus](https://giscus.app) | 以 GitHub Discussions 為後端的留言區與表情回應 |
| CSS Custom Properties | 全站主題變數（teal accent） |
| Google Fonts | Open Sans、Noto Sans TC、IBM Plex Mono（只載入用到的字重） |

## 專案結構

```
src/
├── assets/blog/          # 文章圖片（build 時自動最佳化）
├── components/
│   ├── pages/            # 頁面主體（HomePage、BlogIndexPage、TagPage），中英路由共用
│   └── *.astro           # Nav、Hero、About、Experience、Projects、Skills、
│                         # BlogPreview、Contact、Footer、Comment、PostList
├── content/blog/         # Markdown 文章
├── i18n/                 # en.ts / zh.ts 翻譯檔與語言工具函式（index.ts）
├── layouts/              # BaseLayout（<head>、SEO）、BlogPostLayout（文章頁）
├── pages/
│   ├── index.astro       # 英文首頁 /
│   ├── blog/             # 文章列表 /blog/、文章 /blog/<slug>/、標籤頁 /blog/tags/<tag>/
│   ├── zh/               # 中文版：/zh/、/zh/blog/、/zh/blog/tags/<tag>/
│   ├── og/               # 分享預覽圖 /og/<slug>.png、/og/site.png
│   ├── rss.xml.ts        # RSS /rss.xml
│   └── 404.astro         # 中英並列的 404 頁
├── styles/global.css
└── utils/
    ├── posts.ts          # 取得文章、日期格式、閱讀時間、標籤、系列文章
    ├── og-image.ts       # 產生標題卡片
    └── rehype-image-sizes.mjs  # 設定文章圖片的 sizes
scripts/publish-post.mjs  # Obsidian 筆記上架腳本
```

## 指令

| 指令 | 說明 |
| :--- | :--- |
| `npm install` | 安裝依賴（Node.js 22.12 以上） |
| `npm run dev` | 啟動開發伺服器 `localhost:4321` |
| `npm run check` | TypeScript / Astro 型別檢查 |
| `npm run build` | 建置靜態網站到 `./dist/`（產生預覽圖時需要連得到 Google Fonts） |
| `npm run preview` | 本地預覽建置結果 |
| `npm run publish -- "<筆記路徑>"` | 把 Obsidian 筆記上架成文章 |

## 新增文章

### 方法一：上架腳本（推薦）

在 `main` 分支、沒有未 commit 的變更時執行：

```bash
npm run publish -- "C:\Users\User\Desktop\Jerry\Obsidian 筆記\你的筆記.md"
```

腳本會：

1. 互動式輸入標題、描述（必填）、標籤、slug、發布日期，並檢查格式
2. （選擇 git 流程時）從最新的 `origin/main` 開新分支 `add-blog-<slug>`
3. 清理內容：移除開頭重複的 H1、還原 Obsidian 跳脫的標題（`\#\#` → `##`）
4. 把 `![[image.png]]`、`![[image.png|300]]` 的圖片複製到 `src/assets/blog/<slug>/` 並改成標準 Markdown
5. 寫入 `src/content/blog/<slug>.md`
6. commit、push，並用 `gh pr create` 開 Pull Request（沒有安裝 `gh` 時會印出建立 PR 的連結）

### 方法二：手動建立

在 `src/content/blog/` 新增 `.md` 檔：

```markdown
---
title: "文章標題"
description: "文章描述（必填，會顯示在列表、搜尋結果與分享預覽）"
pubDate: 2026-06-01
updatedDate: 2026-07-01        # 選填，顯示「更新於」
tags: ["System Design", "Backend"]
draft: false                    # true = 不發布（不出現在網站、RSS、sitemap）
lang: zh-TW                     # 選填：en 或 zh-TW；沒填時依標題是否含中文自動判斷
series: "System Design 筆記"    # 選填：系列名稱
seriesOrder: 6                  # 選填：在系列中的順序
---

文章內容（Markdown，支援表格等 GFM 語法）
```

圖片放在 `src/assets/blog/<slug>/`，在文章中用相對路徑引用：

```markdown
![說明文字](../../assets/blog/<slug>/diagram.png)
```

## 部落格功能

- **文章頁**：系列標示與上一篇／下一篇、目錄（3 個以上標題時顯示）、閱讀時間、可點擊的標籤
- **標籤頁**：`/blog/tags/<tag>/`（中文版 `/zh/blog/tags/<tag>/`），文章列表頁上方有全部標籤
- **留言區**：[Giscus](https://giscus.app)，訪客用 GitHub 帳號留言或按表情回應，資料存在 GitHub Discussions
- **分享預覽圖**：每篇文章自動產生 1200×630 的標題卡片
- **RSS**：`/rss.xml`

## 多語系

- 介面文字在 `src/i18n/en.ts` 與 `src/i18n/zh.ts`，兩個檔案的 key 要一致
- 英文頁面沒有網址前綴，中文頁面在 `/zh/` 底下；新增頁面時，把頁面主體寫在 `src/components/pages/`，再分別在 `src/pages/` 和 `src/pages/zh/` 建立只傳入 `lang` 的路由檔
- 文章只有一種語言、只有一個網址（`/blog/<slug>/`），頁面上的介面（導覽列、返回連結、留言區）跟著文章語言顯示
- 右上角的語言切換是連到另一語言的同一頁，並記住訪客的選擇；之後從站外直接進入時會自動導到偏好的語言

## 部署與 CI

- GitHub Actions（`.github/workflows/deploy.yml`）
  - **Pull Request**：執行 `astro check` 與 `astro build`，不部署
  - **push 到 `main`**：檢查、建置並部署到 GitHub Pages
- 開發流程：開分支 → 開 PR → 檢查通過後合併到 `main` → 自動部署
