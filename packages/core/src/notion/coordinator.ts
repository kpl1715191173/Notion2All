import { NotionDataFetcher } from './fetcher'
import { NotionCacheService } from './cache'
import { NotionPageSaver } from './saver'
import { PageObject } from './types'
import { isChildPage } from './page'

/**
 * Notion 页面协调器
 * 负责协调数据获取、缓存和保存的流程
 */
export class NotionPageCoordinator {
  constructor(
    private fetcher: NotionDataFetcher,
    private cacheService: NotionCacheService,
    private saver: NotionPageSaver
  ) {}

  /**
   * 处理页面及其子页面
   * @param pageId 页面ID
   * @param parentPageIds 父页面ID链
   */
  async processPage(pageId: string, parentPageIds: string[] = []): Promise<void> {
    try {
      console.log(
        `\n[开始处理] 页面 ${pageId}${
          parentPageIds.length > 0 ? ` (父页面: ${parentPageIds.join(' -> ')})` : ''
        }`
      )

      // 1. 获取页面数据
      const pageData = await this.fetcher.fetchPageData(pageId)

      // 2. 检查缓存
      const needsUpdate = await this.cacheService.shouldUpdate(
        pageId,
        pageData.last_edited_time,
        parentPageIds
      )

      if (!needsUpdate) {
        console.log(`[使用缓存] 页面 ${pageId} 使用本地缓存`)
        return
      }

      // 3. 获取完整数据
      console.log(`[网络请求] 页面 ${pageId} 需要更新，获取完整内容`)
      const fullData = await this.fetcher.fetchFullPageData(pageId)

      // 4. 保存数据
      console.log(`[保存文件] 保存页面 ${pageId} 的完整内容`)
      const saveResult = await this.saver.savePageData(pageId, fullData, parentPageIds)
      if (!saveResult.success) {
        throw new Error(`保存页面 ${pageId} 失败: ${saveResult.error}`)
      }

      // 5. 处理子页面
      for (const block of fullData.children) {
        if (isChildPage(block)) {
          await this.processPage(block.id, [...parentPageIds, pageId])
        }
      }
    } catch (error) {
      console.error(
        `[错误] 处理页面 ${pageId} 时发生错误:`,
        error instanceof Error ? error.message : String(error)
      )
      throw error
    }
  }
}
