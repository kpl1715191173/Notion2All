import { NotionApi } from './api'
import { NotionBlock, PageObject } from './types'

/**
 * Notion 数据获取服务
 * 负责从 Notion API 获取页面和块数据
 */
export class NotionDataFetcher {
  constructor(private api: NotionApi) {}

  /**
   * 获取页面基本信息
   * @param pageId 页面ID
   * @returns 页面数据
   */
  async fetchPageData(pageId: string): Promise<PageObject> {
    try {
      console.log(`[网络请求] 获取页面 ${pageId} 的基本信息`)
      const pageData = await this.api.getPage(pageId)
      return {
        ...pageData,
        children: [],
      }
    } catch (error) {
      console.error(
        `[错误] 获取页面 ${pageId} 失败:`,
        error instanceof Error ? error.message : String(error)
      )
      throw new Error(
        `获取页面 ${pageId} 失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 获取块的子块列表
   * @param blockId 块ID
   * @returns 子块列表
   */
  async fetchBlockChildren(blockId: string): Promise<NotionBlock[]> {
    try {
      console.log(`[网络请求] 获取块 ${blockId} 的子块列表`)
      const children = await this.api.getBlockChildren(blockId)

      if (!children || !Array.isArray(children)) {
        console.warn(`[警告] 块 ${blockId} 的子块数据格式不正确`)
        return []
      }

      console.log(`[网络请求] 块 ${blockId} 获取到 ${children.length} 个子块`)
      return children.map(block => ({
        ...block,
        children: (block as any).has_children ? [] : undefined,
      })) as NotionBlock[]
    } catch (error) {
      console.error(
        `[错误] 获取块 ${blockId} 的子块失败:`,
        error instanceof Error ? error.message : String(error)
      )
      throw new Error(
        `获取块 ${blockId} 的子块失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 获取页面的完整数据，包括所有子块
   * @param pageId 页面ID
   * @returns 完整的页面数据
   */
  async fetchFullPageData(pageId: string): Promise<PageObject> {
    try {
      const pageData = await this.fetchPageData(pageId)
      const blocks = await this.fetchBlockChildren(pageId)

      // 递归获取所有子块的数据
      const processedBlocks = await this.processBlocks(blocks, pageId)

      return {
        ...pageData,
        children: processedBlocks,
      }
    } catch (error) {
      console.error(
        `[错误] 获取页面 ${pageId} 的完整数据失败:`,
        error instanceof Error ? error.message : String(error)
      )
      throw new Error(
        `获取页面 ${pageId} 的完整数据失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 递归处理块及其子块
   * @param blocks 块列表
   * @param parentPageId 父页面ID
   * @returns 处理后的块列表
   */
  private async processBlocks(blocks: NotionBlock[], parentPageId: string): Promise<NotionBlock[]> {
    const processedBlocks: NotionBlock[] = []

    for (const block of blocks) {
      const blockWithChildren: NotionBlock = {
        ...block,
        children: [],
      }

      if ((block as any).has_children) {
        try {
          const childBlocks = await this.fetchBlockChildren(block.id)
          if (childBlocks.length > 0) {
            blockWithChildren.children = await this.processBlocks(childBlocks, parentPageId)
          }
        } catch (error) {
          console.error(
            `[错误] 处理块 ${block.id} 的子块失败:`,
            error instanceof Error ? error.message : String(error)
          )
        }
      }

      processedBlocks.push(blockWithChildren)
    }

    return processedBlocks
  }
}
