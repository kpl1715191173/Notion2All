import { NotionApi } from '../api'
import { NotionBlock, PageObject } from '../types'
import { LogLevel, NotionBackupLogger } from '@notion2all/utils'

/**
 * Notion 数据获取器
 * 负责从 Notion API 获取数据
 */
export class NotionDataFetcher {
  private logLevel: LogLevel

  constructor(
    private notionApi: NotionApi,
    config?: { logLevel?: LogLevel }
  ) {
    this.logLevel = config?.logLevel || LogLevel.info
  }

  /**
   * 获取页面的基本信息
   * @param config.pageId 页面ID
   */
  async fetchPageData(config: { pageId: string }): Promise<PageObject> {
    const { pageId } = config
    try {
      NotionBackupLogger.fetchData(pageId)
      const pageData = await this.notionApi.getPage({ pageId })
      return {
        ...pageData,
        children: [],
      }
    } catch (error) {
      // 增强错误处理，区分不同的错误类型
      const errorMessage = error instanceof Error ? error.message : String(error)
      NotionBackupLogger.error(pageId, `获取页面数据失败: ${errorMessage}`)

      // 如果是网络相关错误，提供更明确的错误信息
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        throw new Error(`获取页面 ${pageId} 失败: 网络连接问题，请检查网络设置或API访问权限`)
      }

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
      const children = await this.notionApi.getBlockChildren({ blockId })

      if (!children || !Array.isArray(children)) {
        NotionBackupLogger.warning(`[警    告] 块 ${blockId} 的子块数据格式不正确`)
        return []
      }

      const processedChildren = children.map(block => ({
        ...block,
        children: (block as any).has_children ? [] : undefined,
      })) as NotionBlock[]

      NotionBackupLogger.fetchBlockChildren(blockId, processedChildren.length)

      return processedChildren
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      NotionBackupLogger.error(blockId, `获取子块失败: ${errorMessage}`)

      // 添加重试逻辑
      if (errorMessage.includes('fetch') || errorMessage.includes('network')) {
        NotionBackupLogger.warning(`[警    告] 尝试重新获取块 ${blockId} 的子块...`)
        try {
          // 等待短暂时间后重试
          await new Promise(resolve => setTimeout(resolve, 2000))
          const retryChildren = await this.notionApi.getBlockChildren({ blockId })
          if (retryChildren && Array.isArray(retryChildren)) {
            const processedChildren = retryChildren.map(block => ({
              ...block,
              children: (block as any).has_children ? [] : undefined,
            })) as NotionBlock[]
            return processedChildren
          }
        } catch (retryError) {
          NotionBackupLogger.error(blockId, `重试获取子块失败: ${retryError}`)
        }
      }

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
            NotionBackupLogger.error(block.id, error)
            // 继续处理其他块
            results.push(block)
          }
        }

        return results
      }

      pageData.children = await processChildren(children)
      return pageData
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      NotionBackupLogger.error(pageId, `获取完整页面数据失败: ${errorMessage}`)
      throw error
    }
  }
}
