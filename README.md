# 成语辨析刷题 Web App

这是一个纯前端刷题工具。题库随网页打包，学习记录保存在访问者的浏览器 `localStorage` 中。

## 本地开发

```bash
pnpm install
pnpm run dev:static
```

打开终端中显示的本地网址。

## 生成静态网页

```bash
pnpm run build:static
```

发布文件位于 `dist-static` 目录。该目录可上传到任意静态托管服务。

## GitHub Pages

1. 将项目推送到 GitHub 仓库的 `main` 分支。
2. 在仓库 Settings 中打开 Pages。
3. 将 Source 设为 GitHub Actions。
4. `.github/workflows/deploy-pages.yml` 会自动构建和发布。

## Vercel

1. 将项目导入 Vercel。
2. Vercel 会读取 `vercel.json`。
3. 构建命令为 `pnpm run build:static`。
4. 输出目录为 `dist-static`。

## 进度迁移

首页提供导出、导入和清空学习记录。导出文件为 JSON，可在其他浏览器中导入。
