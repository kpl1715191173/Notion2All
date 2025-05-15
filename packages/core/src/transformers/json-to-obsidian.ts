/**
 * JSON到Obsidian Markdown的转换器
 *
 * 将Notion JSON数据转换为Obsidian兼容的Markdown格式
 */

import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { NotionPage, NoteMetadata, ExportOptions } from '../types/index.js'
import { convertToMarkdown } from './json-to-md.js'

/**
 * Obsidian特定的导出选项
 */
export interface ObsidianExportOptions extends ExportOptions {
  /** 是否使用Obsidian的双向链接语法 */
  useWikiLinks?: boolean
  /** 是否创建Obsidian的标签页 */
  createTagPages?: boolean
  /** 是否使用Obsidian的嵌入语法 */
  useObsidianEmbeds?: boolean
  /** 是否添加Obsidian的特殊注释 */
  addObsidianComments?: boolean
}

/**
 * 将Notion页面转换为Obsidian兼容的Markdown
 * @param notionPage Notion页面数据
 * @param options 导出选项
 * @returns Obsidian Markdown字符串
 */
export async function convertToObsidianMarkdown(
  notionPage: NotionPage,
  options: ObsidianExportOptions
): Promise<string> {
  // 首先转换为普通Markdown
  let markdown = await convertToMarkdown(notionPage, options)

  // 应用Obsidian特定的转换
  markdown = applyObsidianTransformations(markdown, notionPage, options)

  return markdown
}

/**
 * 应用Obsidian特定的转换
 * @param markdown 标准Markdown
 * @param notionPage 原始Notion页面
 * @param options Obsidian选项
 * @returns 处理后的Obsidian Markdown
 */
function applyObsidianTransformations(
  markdown: string,
  notionPage: NotionPage,
  options: ObsidianExportOptions
): string {
  let result = markdown

  // 1. 转换标准链接为Wiki链接
  if (options.useWikiLinks) {
    result = convertLinksToWikiLinks(result)
  }

  // 2. 处理嵌入
  if (options.useObsidianEmbeds) {
    result = convertEmbedsToObsidianFormat(result)
  }

  // 3. 转换标签
  result = processObsidianTags(result)

  // 4. 添加Obsidian特有的注释
  if (options.addObsidianComments) {
    const metadata = extractMetadata(notionPage)
    result = addObsidianMetadata(result, metadata)
  }

  return result
}

/**
 * 从Notion页面提取元数据
 * @param notionPage Notion页面
 */
function extractMetadata(notionPage: NotionPage): NoteMetadata {
  const page = notionPage.page

  const metadata: NoteMetadata = {
    title: getPageTitle(page),
    created: page.created_time,
    lastEdited: page.last_edited_time,
  }

  return metadata
}

/**
 * 获取页面标题
 * @param page 页面对象
 */
function getPageTitle(page: any): string {
  // 尝试获取标题属性
  const titleProperty = Object.values(page.properties).find((prop: any) => prop.type === 'title')

  if (titleProperty && Array.isArray(titleProperty.title) && titleProperty.title.length > 0) {
    return titleProperty.title.map((t: any) => t.plain_text).join('')
  }

  // 如果找不到标题，返回页面ID的一部分
  return `Untitled_${page.id.substring(0, 8)}`
}

/**
 * 添加Obsidian特定的元数据
 * @param markdown Markdown内容
 * @param metadata 笔记元数据
 */
function addObsidianMetadata(markdown: string, metadata: NoteMetadata): string {
  // 查找YAML前置元数据的结束位置
  const frontMatterEndIndex = markdown.indexOf('---', 3) + 3

  if (frontMatterEndIndex <= 3) {
    return markdown
  }

  // Obsidian特有的注释
  const obsidianComment = `
<!-- 
obsidian-metadata:
  cssclasses: notion-page
  aliases: [${metadata.title}]
-->
`

  // 在YAML后插入Obsidian注释
  return (
    markdown.substring(0, frontMatterEndIndex) +
    obsidianComment +
    markdown.substring(frontMatterEndIndex)
  )
}

/**
 * 将标准Markdown链接转换为Obsidian的Wiki链接
 * @param markdown Markdown内容
 */
function convertLinksToWikiLinks(markdown: string): string {
  // 正则表达式匹配标准Markdown链接
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g

  // 将链接转换为Wiki链接格式 [[target|text]]
  return markdown.replace(linkRegex, (match, text, url) => {
    // 如果是外部链接，保持原样
    if (url.startsWith('http') || url.startsWith('www') || url.includes('://')) {
      return match
    }

    // 移除文件扩展名
    let target = url
    if (target.endsWith('.md')) {
      target = target.substring(0, target.length - 3)
    }

    // 创建Wiki链接
    return `[[${target}|${text}]]`
  })
}

/**
 * 将标准嵌入转换为Obsidian嵌入格式
 * @param markdown Markdown内容
 */
function convertEmbedsToObsidianFormat(markdown: string): string {
  // 匹配图片
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g

  // 将图片链接转换为Obsidian嵌入格式
  return markdown.replace(imageRegex, (match, alt, url) => {
    // 如果是外部图片，保持原样
    if (url.startsWith('http') || url.startsWith('www') || url.includes('://')) {
      return match
    }

    // 创建Obsidian嵌入格式
    return `![[${url}|${alt}]]`
  })
}

/**
 * 处理Obsidian标签
 * @param markdown Markdown内容
 */
function processObsidianTags(markdown: string): string {
  // 在YAML前置元数据中查找标签
  const yamlTagRegex = /tags:\s*\n((\s+-\s+.+\n)+)/g

  return markdown.replace(yamlTagRegex, (match, tagLines) => {
    // 将YAML中的标签也添加到正文中
    const footerTags = tagLines
      .split('\n')
      .filter(line => line.trim().startsWith('-'))
      .map(line => {
        const tag = line.trim().substring(1).trim()
        return `#${tag.replace(/\s+/g, '-')}`
      })
      .join(' ')

    // 在文档末尾添加标签
    const tagFooter = `\n\n---\n\n${footerTags}\n`

    // 保留原始的YAML标签定义
    return match + tagFooter
  })
}
