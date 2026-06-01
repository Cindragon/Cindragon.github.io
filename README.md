# Jerry Tsai — Personal Portfolio & Blog

個人作品集與部落格網站，使用 Astro 框架建置，從原本的純 HTML/CSS/JS 網站遷移而來。

## 網站用途

- **個人作品集**：展示個人經歷、專案、技能與證照
- **技術部落格**：撰寫並分享系統設計、演算法、韌體開發等技術文章
- **雙語支援**：支援英文 / 繁體中文即時切換

## 技術棧

| 技術 | 用途 |
| :--- | :--- |
| [Astro](https://astro.build) 6 | 靜態網站框架，檔案路由、Content Collections |
| TypeScript | 型別安全的 i18n 系統與腳本 |
| CSS Custom Properties | 全站主題設計系統（teal accent） |
| Astro Content Collections | Markdown 部落格文章管理，支援 draft 隱藏 |
| Google Fonts | Open Sans、Noto Sans TC、IBM Plex Mono |
| Canvas API | 粒子動畫背景 |
| IntersectionObserver | Scroll reveal 滾動動畫 |

## 專案結構

```
src/
├── components/       # 頁面元件（Nav, Hero, About, Experience, Projects, Skills, BlogPreview, Contact, Footer）
├── content/blog/     # Markdown 部落格文章
├── i18n/             # 英文 / 中文翻譯檔
├── layouts/          # BaseLayout, BlogPostLayout
├── pages/            # 首頁 + Blog 列表頁 + 文章動態路由
└── styles/           # 全域 CSS
public/blog/          # 文章圖片
```

## 指令

| 指令 | 說明 |
| :--- | :--- |
| `npm install` | 安裝依賴 |
| `npm run dev` | 啟動開發伺服器 `localhost:4321` |
| `npm run build` | 建置靜態網站到 `./dist/` |
| `npm run preview` | 本地預覽建置結果 |

## 新增文章

在 `src/content/blog/` 建立 `.md` 檔案：

```markdown
---
title: "文章標題"
description: "文章描述"
pubDate: 2026-06-01
tags: ["tag1", "tag2"]
draft: false
---

文章內容（支援標準 Markdown 語法）
```

將 `draft` 設為 `true` 可隱藏文章。
