import { NotionApi } from './api'
import { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { NotionPageSaver } from './services/saver'
import type { NotionBlock as NotionBlockType } from './types'

// 使用本地类型定义
type NotionBlock = BlockObjectResponse & {
  children?: NotionBlock[]
}

/**
 * 获取完整页面数据的选项
 */
export interface GetFullPageDataOptions {
  saveToFile?: boolean
  outputDir?: string
}

export async function getAllBlocks(
  api: NotionApi,
  blockId: string,
  options?: GetFullPageDataOptions,
  parentPageId?: string
): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = []

  try {
    console.log(
      `[网络请求] 获取block ${blockId} 的子blocks${parentPageId ? ` (父页面: ${parentPageId})` : ''}`
    )
    const children = await api.getBlockChildren(blockId)

    // 检查是否成功获取到子块数据
    if (!children || !Array.isArray(children)) {
      console.warn(`[警告] block ${blockId} 的子blocks数据格式不正确`)
      return blocks
    }
    console.log(`[网络请求] block ${blockId} 获取到 ${children.length} 个子blocks`)

    for (const block of children) {
      console.log(block)
      if ('type' in block) {
        const blockWithChildren: NotionBlock = {
          ...(block as BlockObjectResponse),
          children: [],
        }

        // 处理子页面
        if (block.type === 'child_page') {
          console.log(`[处理] block ${block.id} 是子页面，开始获取完整内容`)
          // 获取子页面的完整数据
          const childPageData = await getFullPageData(api, block.id, options, blockId)

          // 如果需要保存到文件
          if (options?.saveToFile && options?.outputDir) {
            const saver = new NotionPageSaver(options.outputDir)
            // 保存子页面到父页面目录下
            await saver.savePageData(block.id, childPageData, [blockId])
          }

          // 在父页面中只保留子页面的基本信息
          const childPageBlock = {
            id: block.id,
            type: 'child_page',
            has_children: false,
            created_time: childPageData.created_time,
            last_edited_time: childPageData.last_edited_time,
            archived: childPageData.archived,
            url: childPageData.url,
            object: 'block',
            parent: childPageData.parent,
            created_by: childPageData.created_by,
            last_edited_by: childPageData.last_edited_by,
            in_trash: false,
            child_page: {
              title: '',
            },
          } as unknown as NotionBlock

          blockWithChildren.children = [childPageBlock]
          console.log(`[完成] block ${block.id} 子页面处理完成`)
        }
        // 处理其他有子块的类型
        else if (block?.has_children) {
          console.log(`[处理] block ${block.id} 包含子块，类型: ${block.type}`)
          try {
            // 获取子块数据
            const childBlocks = await getAllBlocks(api, block.id, options, parentPageId)

            // 检查子块数据是否有效
            if (childBlocks && Array.isArray(childBlocks) && childBlocks.length > 0) {
              console.log(`[完成] block ${block.id} 获取到 ${childBlocks.length} 个子块`)
              blockWithChildren.children = childBlocks
            } else {
              console.warn(`[警告] block ${block.id} 标记为有子块，但未获取到子块数据`)
            }
          } catch (error) {
            console.error(
              `[错误] block ${block.id} 获取子块失败: ${error instanceof Error ? error.message : String(error)}`
            )
            // 继续处理其他块，不中断整个流程
          }
        }

        blocks.push(blockWithChildren)
      }
    }
  } catch (error) {
    console.error(
      `[错误] block ${blockId} 获取子blocks失败: ${error instanceof Error ? error.message : String(error)}`
    )
    throw new Error(
      `获取block ${blockId} 的子blocks失败: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  return blocks
}

export async function getFullPageData(
  api: NotionApi,
  pageId: string,
  options?: GetFullPageDataOptions,
  parentPageId?: string
) {
  const pageData = await api.getPage(pageId)
  const blocks = await getAllBlocks(api, pageData.id, options, parentPageId)

  const fullData = {
    ...pageData,
    children: blocks,
  }

  // 保存页面数据
  if (options?.saveToFile && options?.outputDir) {
    const saver = new NotionPageSaver(options.outputDir)
    const saveResult = await saver.savePageData(
      pageId,
      fullData,
      parentPageId ? [parentPageId] : undefined
    )

    if (!saveResult.success) {
      throw new Error(`保存页面数据失败: ${saveResult.error}`)
    }
  }

  return fullData
}

/**
 * 格式化页面 ID，确保使用带连字符的格式
 * @param pageId 页面ID
 * @returns 格式化后的页面ID
 */
export function formatPageId(pageId: string): string {
  if (pageId.includes('-')) return pageId
  return pageId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
}

/**
 * 检查块是否为子页面
 * @param block 块对象
 * @returns 是否为子页面
 */
export function isChildPage(block: NotionBlock): boolean {
  return block.type === 'child_page'
}

/**
 * 检查块是否有子块
 * @param block 块对象
 * @returns 是否有子块
 */
export function hasChildren(block: NotionBlock): boolean {
  return block.has_children === true
}
