import { NotionApi } from '../api'
import { NotionBlock, PageObject } from '../types'
import { LogLevel, NotionBackupLogger } from '@notion2all/utils'

/**
 * Notion 数据获取器
 * 负责从 Notion API 获取数据
 */
export class NotionDataFetcher {
  private logLevel: LogLevel

  constructor(private notionApi: NotionApi, config?: { logLevel?: LogLevel }) {
    this.logLevel = config?.logLevel || LogLevel.level0
  }

  /**
   * 获取页面的基本信息
   * @param config.pageId 页面ID
   */
  async fetchPageData(config: { pageId: string }): Promise<PageObject> {
    const { pageId } = config
    try {
      NotionBackupLogger.fetchData(pageId, this.logLevel)
      const pageData = await this.notionApi.getPage({ pageId })
      return {
        ...pageData,
        children: [],
      }
    } catch (error) {
      NotionBackupLogger.error(pageId, error, this.logLevel)
      throw error
    }
  }

  /**
   * 获取块的子块列表
   * @param config.blockId 块ID
   */
  async fetchBlockChildren(config: { blockId: string }): Promise<NotionBlock[]> {
    const { blockId } = config
    try {
      NotionBackupLogger.fetchBlockChildren(blockId, this.logLevel)
      const children = await this.notionApi.getBlockChildren({ blockId })

      if (!children || !Array.isArray(children)) {
        NotionBackupLogger.warning(`[警告] 块 ${blockId} 的子块数据格式不正确`, this.logLevel)
        return []
      }

      NotionBackupLogger.fetchBlockChildrenComplete(blockId, children.length, this.logLevel)
      return children.map(block => ({
        ...block,
        children: (block as any).has_children ? [] : undefined,
      })) as NotionBlock[]
    } catch (error) {
      NotionBackupLogger.error(blockId, error, this.logLevel)
      throw error
    }
  }

  /**
   * 获取页面的完整数据（包括所有子块）
   * @param config.pageId 页面ID
   */
  async fetchFullPageData(config: { pageId: string }): Promise<PageObject> {
    const { pageId } = config
    try {
      const pageData = await this.fetchPageData({ pageId })
      const children = await this.fetchBlockChildren({ blockId: pageId })

      // 递归获取所有子块
      const processChildren = async (blocks: NotionBlock[]): Promise<NotionBlock[]> => {
        const results: NotionBlock[] = []

        for (const block of blocks) {
          try {
            if ((block as any).has_children) {
              const childBlocks = await this.fetchBlockChildren({ blockId: block.id })
              block.children = await processChildren(childBlocks)
            }
            results.push(block)
          } catch (error) {
            NotionBackupLogger.error(block.id, error, this.logLevel)
            // 继续处理其他块
            results.push(block)
          }
        }

        return results
      }

      pageData.children = await processChildren(children)
      return pageData
    } catch (error) {
      NotionBackupLogger.error(pageId, error, this.logLevel)
      throw error
    }
  }

  /**
   * 设置日志级别
   * @param level 日志级别
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }
}
