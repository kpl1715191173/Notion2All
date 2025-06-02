import { NotionDataFetcher } from './fetcher'
import { NotionCacheService } from './cache'
import { NotionPageSaver } from './saver'
import { NotionFileDownloader } from './file-downloader'
import { PageObject } from './types'
import { isChildPage } from './page'
import { notionLog, LogLevel, timer } from '@notion2all/utils'

/**
 * Notion 页面协调器
 * 负责协调数据获取、缓存和保存的流程
 */
export class NotionPageCoordinator {
  private fileDownloader: NotionFileDownloader

  /**
   * @param fetcher 数据获取器
   * @param cacheService 缓存服务
   * @param saver 保存器
   * @param config 配置对象
   */
  constructor(
    private fetcher: NotionDataFetcher,
    private cacheService: NotionCacheService,
    private saver: NotionPageSaver,
    private config: {
      recursive?: boolean
      includeImages?: boolean
      concurrency?: number
      logLevel?: LogLevel
    } = {}
  ) {
    this.fileDownloader = new NotionFileDownloader(this.saver.getOutputDir())
    // 设置默认值
    this.config.recursive = this.config.recursive ?? true
    this.config.includeImages = this.config.includeImages ?? false
    this.config.concurrency = this.config.concurrency ?? 5
    this.config.logLevel = this.config.logLevel ?? LogLevel.level0
  }

  /**
   * 从块中提取图片信息
   * @param blocks 块数组
   * @returns 图片信息数组
   */
  private extractImageUrls(blocks: any[]): Array<{ blockId: string; url: string }> {
    const images: Array<{ blockId: string; url: string }> = []
    
    for (const block of blocks) {
      if (block.type === 'image') {
        const imageUrl = block[block.type]?.file?.url || block[block.type]?.external?.url
        if (imageUrl) {
          images.push({
            blockId: block.id,
            url: imageUrl
          })
        }
      }
      
      // 递归处理子块
      if (block.children && Array.isArray(block.children)) {
        images.push(...this.extractImageUrls(block.children))
      }
    }
    
    return images
  }

  /**
   * 处理页面及其子页面
   * @param pageId 页面ID
   * @param parentPageIds 父页面ID链
   */
  async processPage(pageId: string, parentPageIds: string[] = []): Promise<void> {
    try {
      notionLog.processStart(pageId, parentPageIds, this.config.logLevel)

      // 1. 获取页面数据
      const pageData = await this.fetcher.fetchPageData(pageId)

      // 2. 检查缓存
      const needsUpdate = await this.cacheService.shouldUpdate(
        pageId,
        pageData.last_edited_time,
        parentPageIds
      )

      if (!needsUpdate) {
        notionLog.useCache(pageId, this.config.logLevel)
        return
      }

      // 3. 获取完整数据
      notionLog.fetchData(pageId, this.config.logLevel)
      const fullData = await this.fetcher.fetchFullPageData(pageId)

      // 4. 保存数据
      notionLog.saveData(pageId, this.config.logLevel)
      const saveResult = await this.saver.savePageData(pageId, fullData, parentPageIds)
      if (!saveResult.success) {
        throw new Error(`保存页面 ${pageId} 失败: ${saveResult.error}`)
      }

      // 5. 下载图片（如果配置允许）
      if (this.config.includeImages) {
        const imageUrls = this.extractImageUrls(fullData.children)
        if (imageUrls.length > 0) {
          notionLog.downloadFiles(pageId, imageUrls.length, this.config.logLevel)
          await this.fileDownloader.saveFiles(pageId, imageUrls)
        }
      }

      // 6. 处理子页面
      if (this.config.recursive) {
        const childPages = fullData.children.filter(block => isChildPage(block))
        if (childPages.length > 0) {
          notionLog.childPages(pageId, childPages.length, this.config.logLevel)

          if (!this.config.concurrency || this.config.concurrency <= 0) {
            // 串行处理
            const startTime = timer.start()
            for (const childPage of childPages) {
              await this.processPage(childPage.id, [...parentPageIds, pageId])
            }
            const timeUsed = timer.end(startTime)
            notionLog.serialComplete(pageId, childPages.length, timeUsed, this.config.logLevel)
          } else {
            // 并发处理
            notionLog.concurrentProcess(this.config.concurrency, childPages.length, this.config.logLevel)
            const startTime = timer.start()
            
            // 分批处理子页面
            for (let i = 0; i < childPages.length; i += this.config.concurrency) {
              const batch = childPages.slice(i, i + this.config.concurrency)
              const promises = batch.map(childPage =>
                this.processPage(childPage.id, [...parentPageIds, pageId])
              )
              await Promise.all(promises)
            }

            const timeUsed = timer.end(startTime)
            notionLog.concurrentComplete(pageId, childPages.length, timeUsed, this.config.logLevel)
          }
        }
      }
    } catch (error) {
      notionLog.error(pageId, error, this.config.logLevel)
      throw error
    }
  }
}
