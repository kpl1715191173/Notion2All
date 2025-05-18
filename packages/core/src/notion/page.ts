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

export async function getAllBlocks(api: NotionApi, blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = []
  
  try {
    const children = await api.getBlockChildren(blockId)
    
    for (const block of children) {
      if ('type' in block) {
        const blockWithChildren: NotionBlock = {
          ...block as BlockObjectResponse,
          children: []
        }
        
        // 处理子页面
        if (block.type === 'child_page') {
          // 获取子页面的完整数据
          const childPageData = await getFullPageData(api, block.id)
          blockWithChildren.children = childPageData.children
        }
        // 处理其他有子块的类型
        else if ('has_children' in block && block.has_children) {
          blockWithChildren.children = await getAllBlocks(api, block.id)
        }
        
        blocks.push(blockWithChildren)
      }
    }
  } catch (error) {
    throw new Error(`获取block ${blockId} 的子blocks失败: ${error instanceof Error ? error.message : String(error)}`)
  }
  
  return blocks
}

export async function getFullPageData(
  api: NotionApi,
  pageId: string,
  options?: GetFullPageDataOptions
) {
  const pageData = await api.getPage(pageId)
  const blocks = await getAllBlocks(api, pageData.id)
  
  const fullData = {
    ...pageData,
    children: blocks
  }

  // 如果需要保存到文件
  if (options?.saveToFile && options?.outputDir) {
    const saver = new NotionPageSaver(options.outputDir)
    const saveResult = await saver.savePageData(pageId, fullData)
    
    if (!saveResult.success) {
      throw new Error(`保存页面数据失败: ${saveResult.error}`)
    }
  }

  return fullData
} 