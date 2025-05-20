import { NotionApi } from './api'
import { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { NotionPageSaver } from './saver'

export type NotionBlock = BlockObjectResponse & {
  children?: NotionBlock[]
}

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
    const children = await api.getBlockChildren(blockId)

    for (const block of children) {
      if ('type' in block) {
        const blockWithChildren: NotionBlock = {
          ...(block as BlockObjectResponse),
          children: [],
        }

        // 处理子页面
        if (block.type === 'child_page') {
          // 获取子页面的完整数据
          const childPageData = await getFullPageData(api, block.id, options, blockId)

          // 如果需要保存到文件
          if (options?.saveToFile && options?.outputDir) {
            const saver = new NotionPageSaver(options.outputDir)
            // 保存子页面到父页面目录下
            await saver.savePageData(block.id, childPageData, blockId)
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
        }
        // 处理其他有子块的类型
        else if ('has_children' in block && block.has_children) {
          blockWithChildren.children = await getAllBlocks(api, block.id, options, parentPageId)
        }

        blocks.push(blockWithChildren)
      }
    }
  } catch (error) {
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
    const saveResult = await saver.savePageData(pageId, fullData, parentPageId)

    if (!saveResult.success) {
      throw new Error(`保存页面数据失败: ${saveResult.error}`)
    }
  }

  return fullData
}
