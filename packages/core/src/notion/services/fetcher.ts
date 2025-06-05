import { NotionApi } from '../api'
import { NotionBlock, PageObject } from '../types'
import { logger, LogLevel } from '@notion2all/utils'

/**
 * Notion 数据获取器
 * 负责从 Notion API 获取数据
 */
export class NotionDataFetcher {
  constructor(private notionApi: NotionApi) {}

  /**
   * 获取页面的基本信息
   * @param pageId 页面ID
   */
  async fetchPageData(pageId: string): Promise<PageObject> {
    try {
      logger.log(`[网络请求] 获取页面 ${pageId} 的基本信息`, LogLevel.level1)
      const pageData = await this.notionApi.getPage(pageId)
      return {
        ...pageData,
        children: [],
      }
    } catch (error) {
      logger.error(
        `[错误] 获取页面 ${pageId} 失败: ${error instanceof Error ? error.message : String(error)}`,
        LogLevel.level1
      )
      throw error
    }
  }

  /**
   * 获取块的子块列表
   * @param blockId 块ID
   */
  async fetchBlockChildren(blockId: string): Promise<NotionBlock[]> {
    try {
      logger.log(`[网络请求] 获取块 ${blockId} 的子块列表`, LogLevel.level1)
      const children = await this.notionApi.getBlockChildren(blockId)

      if (!children || !Array.isArray(children)) {
        logger.warning(`[警告] 块 ${blockId} 的子块数据格式不正确`, LogLevel.level1)
        return []
      }

      logger.log(`[网络请求] 块 ${blockId} 获取到 ${children.length} 个子块`, LogLevel.level1)
      return children.map(block => ({
        ...block,
        children: (block as any).has_children ? [] : undefined,
      })) as NotionBlock[]
    } catch (error) {
      logger.error(
        `[错误] 获取块 ${blockId} 的子块失败: ${error instanceof Error ? error.message : String(error)}`,
        LogLevel.level1
      )
      throw error
    }
  }

  /**
   * 获取页面的完整数据（包括所有子块）
   * @param pageId 页面ID
   */
  async fetchFullPageData(pageId: string): Promise<PageObject> {
    try {
      const pageData = await this.fetchPageData(pageId)
      const children = await this.fetchBlockChildren(pageId)

      // 递归获取所有子块
      const processChildren = async (blocks: NotionBlock[]): Promise<NotionBlock[]> => {
        const results: NotionBlock[] = []

        for (const block of blocks) {
          try {
            if ((block as any).has_children) {
              const childBlocks = await this.fetchBlockChildren(block.id)
              block.children = await processChildren(childBlocks)
            }
            results.push(block)
          } catch (error) {
            logger.error(
              `[错误] 处理块 ${block.id} 的子块失败: ${error instanceof Error ? error.message : String(error)}`,
              LogLevel.level1
            )
            // 继续处理其他块
            results.push(block)
          }
        }

        return results
      }

      pageData.children = await processChildren(children)
      return pageData
    } catch (error) {
      logger.error(
        `[错误] 获取页面 ${pageId} 的完整数据失败: ${error instanceof Error ? error.message : String(error)}`,
        LogLevel.level1
      )
      throw error
    }
  }
} 