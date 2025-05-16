# Notion2All

一个用于将 Notion 页面导出为多种格式的工具。

## 功能特点

- 📥 通过Notion官方API备份笔记为JSON格式
- 📤 导出为多种格式（Markdown, Obsidian兼容Markdown）
- 🌐 自动生成基于Next.js的个人博客网站
- 🔄 增量同步，仅更新变化的内容
- 🔍 强大的搜索和标签功能
- 💻 简单易用的命令行工具

## 项目结构

项目采用pnpm工作空间进行多包管理：

- `@notion2all/core`: 核心功能，API交互和数据转换
- `@notion2all/web`: Next.js实现的博客网站
- `@notion2all/cli`: 命令行工具

## 快速开始

1. 初始化项目：

```bash
pnpm install
```

这个命令会自动：

- 安装所需依赖
- 创建全局链接（后续全局命令待实现）
- 设置 API_KEY

2. 设置API_KEY：

```bash
pnpm notion2all config --api-key YOUR_API_KEY
```

## API_KEY 设置方式

你可以通过以下三种方式设置 API_KEY：

1. 使用 CLI 命令（推荐）：

```bash
pnpm notion2all init --api-key YOUR_API_KEY
```

2. 在项目根目录创建 .env 文件：

```
NOTION_API_KEY=YOUR_API_KEY
```

3. 设置环境变量：

```bash
# Linux/Mac
export API_KEY=YOUR_API_KEY

# Windows
set API_KEY=YOUR_API_KEY
```

## 开发

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build

# 代码检查
pnpm lint
```

## 许可证

MIT
