/**
 * 核心类型定义
 */

import type { PageObjectResponse, BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints';

/**
 * 笔记格式类型
 */
export enum NoteFormat {
  /** JSON格式 */
  JSON = 'json',
  /** Markdown格式 */
  MARKDOWN = 'md',
  /** Obsidian兼容的Markdown格式 */
  OBSIDIAN = 'obsidian',
}

/**
 * 导出选项
 */
export interface ExportOptions {
  /** 导出格式 */
  format: NoteFormat;
  /** 输出目录 */
  outputDir: string;
  /** 是否包含图片 */
  includeImages?: boolean;
  /** 图片保存目录 */
  assetDir?: string;
}

/**
 * Notion页面数据
 */
export interface NotionPage {
  /** 页面对象 */
  page: PageObjectResponse;
  /** 页面内容块 */
  blocks: BlockObjectResponse[];
  /** 子页面 */
  subpages?: NotionPage[];
}

/**
 * 导出结果
 */
export interface ExportResult {
  /** 成功导出的文件数 */
  fileCount: number;
  /** 导出的文件路径列表 */
  files: string[];
  /** 导出的总字节数 */
  totalBytes: number;
  /** 导出耗时(ms) */
  timeMs: number;
}

/**
 * 笔记元数据
 */
export interface NoteMetadata {
  /** 笔记标题 */
  title: string;
  /** 创建时间 */
  created: string;
  /** 最后修改时间 */
  lastEdited: string;
  /** 作者 */
  author?: string;
  /** 标签 */
  tags?: string[];
  /** 原始URL */
  originalUrl?: string;
} 

export * from './notionApi'