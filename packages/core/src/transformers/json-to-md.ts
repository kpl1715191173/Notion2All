/**
 * JSON到Markdown的转换器
 *
 * 将Notion JSON数据转换为Markdown格式
 */

import type { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { NotionPage, NoteMetadata, ExportOptions } from '../types'

/**
 * 将Notion页面转换为Markdown
 * @param notionPage Notion页面数据
 * @param options 导出选项
 * @returns Markdown字符串
 */
export async function convertToMarkdown(
  notionPage: NotionPage,
  options: ExportOptions
): Promise<void> {
// ): Promise<string> {
  // 提取元数据
  // const metadata = extractMetadata(notionPage)
  //
  // // 生成YAML前置元数据
  // const frontMatter = generateFrontMatter(metadata)
  //
  // // 转换内容块
  // const content = await convertBlocks(notionPage.blocks, options)
  //
  // // 组合成最终的Markdown
  // return `${frontMatter}\n\n${content}`
}

// /**
//  * 从Notion页面提取元数据
//  * @param notionPage Notion页面
//  * @returns 笔记元数据
//  */
// function extractMetadata(notionPage: NotionPage): NoteMetadata {
//   const page = notionPage.page

//   const metadata: NoteMetadata = {
//     title: getPageTitle(page),
//     created: page.created_time,
//     lastEdited: page.last_edited_time,
//   }

//   // 提取更多元数据（标签等）
//   // ...

//   return metadata
// }

// /**
//  * 获取页面标题
//  * @param page 页面对象
//  * @returns 页面标题
//  */
// function getPageTitle(page: any): string {
//   // 尝试获取标题属性
//   const titleProperty = Object.values(page.properties).find((prop: any) => prop.type === 'title')

//   if (titleProperty && Array.isArray(titleProperty.title) && titleProperty.title.length > 0) {
//     return titleProperty.title.map((t: any) => t.plain_text).join('')
//   }

//   // 如果找不到标题，返回页面ID的一部分
//   return `Untitled_${page.id.substring(0, 8)}`
// }

// /**
//  * 生成YAML前置元数据
//  * @param metadata 笔记元数据
//  * @returns YAML前置元数据字符串
//  */
// function generateFrontMatter(metadata: NoteMetadata): string {
//   let yaml = '---\n'

//   yaml += `title: "${metadata.title}"\n`
//   yaml += `date: "${new Date(metadata.created).toISOString()}"\n`
//   yaml += `lastEdited: "${new Date(metadata.lastEdited).toISOString()}"\n`

//   if (metadata.tags && metadata.tags.length > 0) {
//     yaml += 'tags:\n'
//     metadata.tags.forEach(tag => {
//       yaml += `  - ${tag}\n`
//     })
//   }

//   if (metadata.author) {
//     yaml += `author: "${metadata.author}"\n`
//   }

//   if (metadata.originalUrl) {
//     yaml += `originalUrl: "${metadata.originalUrl}"\n`
//   }

//   yaml += '---'

//   return yaml
// }

// /**
//  * 转换Notion块为Markdown
//  * @param blocks Notion内容块数组
//  * @param options 导出选项
//  * @returns Markdown内容
//  */
// async function convertBlocks(
//   blocks: BlockObjectResponse[],
//   options: ExportOptions
// ): Promise<string> {
//   let markdown = ''

//   for (const block of blocks) {
//     markdown += await convertBlock(block, options)
//   }

//   return markdown
// }

// /**
//  * 转换单个Notion块为Markdown
//  * @param block Notion块
//  * @param options 导出选项
//  * @returns 块的Markdown表示
//  */
// async function convertBlock(block: BlockObjectResponse, options: ExportOptions): Promise<string> {
//   // 根据块类型进行转换
//   switch (block.type) {
//     case 'paragraph':
//       return handleParagraph(block)

//     case 'heading_1':
//       return handleHeading(block, 1)

//     case 'heading_2':
//       return handleHeading(block, 2)

//     case 'heading_3':
//       return handleHeading(block, 3)

//     case 'bulleted_list_item':
//       return handleBulletedListItem(block)

//     case 'numbered_list_item':
//       return handleNumberedListItem(block)

//     case 'to_do':
//       return handleTodo(block)

//     case 'code':
//       return handleCode(block)

//     case 'image':
//       return await handleImage(block, options)

//     default:
//       // 对于未处理的块类型，返回注释
//       return `<!-- Unsupported block type: ${block.type} -->\n\n`
//   }
// }

// /**
//  * 处理段落块
//  */
// function handleParagraph(block: any): string {
//   const text = getTextContent(block.paragraph.rich_text)
//   return `${text}\n\n`
// }

// /**
//  * 处理标题块
//  */
// function handleHeading(block: any, level: number): string {
//   const text = getTextContent(block[`heading_${level}`].rich_text)
//   const hashes = '#'.repeat(level)
//   return `${hashes} ${text}\n\n`
// }

// /**
//  * 处理无序列表项
//  */
// function handleBulletedListItem(block: any): string {
//   const text = getTextContent(block.bulleted_list_item.rich_text)
//   return `- ${text}\n`
// }

// /**
//  * 处理有序列表项
//  */
// function handleNumberedListItem(block: any): string {
//   const text = getTextContent(block.numbered_list_item.rich_text)
//   return `1. ${text}\n`
// }

// /**
//  * 处理待办事项
//  */
// function handleTodo(block: any): string {
//   const text = getTextContent(block.to_do.rich_text)
//   const checked = block.to_do.checked
//   const checkbox = checked ? '[x]' : '[ ]'
//   return `- ${checkbox} ${text}\n`
// }

// /**
//  * 处理代码块
//  */
// function handleCode(block: any): string {
//   const text = getTextContent(block.code.rich_text)
//   const language = block.code.language || ''
//   return `\`\`\`${language}\n${text}\n\`\`\`\n\n`
// }

// /**
//  * 处理图片块
//  */
// async function handleImage(block: any, options: ExportOptions): Promise<string> {
//   // 这里应该处理图片下载逻辑，但简化实现
//   const caption = block.image.caption ? getTextContent(block.image.caption) : ''

//   let imageUrl = ''
//   if (block.image.type === 'external') {
//     imageUrl = block.image.external.url
//   } else if (block.image.type === 'file') {
//     imageUrl = block.image.file.url

//     // 如果需要保存图片到本地
//     if (options.includeImages && options.assetDir) {
//       // 这里应该实现图片下载并返回相对路径
//       // imageUrl = await downloadImage(imageUrl, options.assetDir);
//     }
//   }

//   return `![${caption}](${imageUrl})\n\n`
// }

// /**
//  * 获取富文本内容
//  */
// function getTextContent(richText: any[]): string {
//   if (!richText || richText.length === 0) {
//     return ''
//   }

//   return richText
//     .map(text => {
//       let content = text.plain_text

//       // 应用格式
//       if (text.annotations.bold) {
//         content = `**${content}**`
//       }

//       if (text.annotations.italic) {
//         content = `*${content}*`
//       }

//       if (text.annotations.strikethrough) {
//         content = `~~${content}~~`
//       }

//       if (text.annotations.code) {
//         content = `\`${content}\``
//       }

//       // 处理链接
//       if (text.href) {
//         content = `[${content}](${text.href})`
//       }

//       return content
//     })
//     .join('')
// }
