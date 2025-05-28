import { NotionDataFetcher } from './fetcher'
import { NotionCacheService } from './cache'
import { NotionPageSaver } from './saver'
import { PageObject } from './types'
import { isChildPage } from './page'

// 计时器工具函数
const timer = {
  start: () => {
    return process.hrtime.bigint()
  },
  end: (startTime: bigint) => {
    const endTime = process.hrtime.bigint()
    const timeInMs = Number(endTime - startTime) / 1_000_000
    return timeInMs.toFixed(2)
  },
}

/**
 * Notion 页面协调器
 * 负责协调数据获取、缓存和保存的流程
 */
export class NotionPageCoordinator {
  /**
   * @param fetcher 数据获取器
   * @param cacheService 缓存服务
   * @param saver 保存器
   * @param concurrency 并发数量，0表示不使用并发
   */
  constructor(
    private fetcher: NotionDataFetcher,
    private cacheService: NotionCacheService,
    private saver: NotionPageSaver,
    private concurrency: number
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
      const childPages = fullData.children.filter(block => isChildPage(block))

      if (childPages.length > 0) {
        console.log(`[子页面处理] ${pageId} 有 ${childPages.length} 个子页面需要处理`)

        if (this.concurrency <= 0) {
          // 传统的串行处理
          const startTime = timer.start()

          for (const block of childPages) {
            await this.processPage(block.id, [...parentPageIds, pageId])
          }

          const timeUsed = timer.end(startTime)
          console.log(
            `[串行子页面] 页面 ${pageId} 的 ${childPages.length} 个子页面处理完成，耗时: ${timeUsed} ms`
          )
        } else {
          // 并发处理子页面，但限制并发数
          console.log(
            `[并发处理] 使用并发数 ${this.concurrency} 处理 ${childPages.length} 个子页面`
          )

          const startTime = timer.start()

          // 实现批量处理，避免一次性创建太多Promise
          for (let i = 0; i < childPages.length; i += this.concurrency) {
            const batch = childPages.slice(i, i + this.concurrency)
            const childPromises = batch.map(block =>
              this.processPage(block.id, [...parentPageIds, pageId])
            )
            await Promise.all(childPromises)
          }

          const timeUsed = timer.end(startTime)
          console.log(
            `[并发子页面] 页面 ${pageId} 的 ${childPages.length} 个子页面处理完成，耗时: ${timeUsed} ms`
          )
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
