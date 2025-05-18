import { NotionApi } from './api'
import { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'

export type NotionBlock = BlockObjectResponse & {
  children?: NotionBlock[]
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
        
        if ('has_children' in block && block.has_children) {
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

export async function getFullPageData(api: NotionApi, pageId: string) {
  const pageData = await api.getPage(pageId)
  const blocks = await getAllBlocks(api, pageData.id)
  
  return {
    ...pageData,
    children: blocks
  }
} 