import { NotionDataFetcher } from './fetcher'
import { NotionCacheService } from './cache'
import { NotionPageSaver } from './saver'
import { NotionFileDownloader } from './file-downloader'
import { isChildPage, logger, LogLevel, NotionLogger } from '@notion2all/utils'

/**
 * Notion 页面协调器
 * 负责协调数据获取、缓存和保存的流程
 */
export class NotionPageCoordinator {
  private fileDownloader: NotionFileDownloader
  private fetcher: NotionDataFetcher
  private cacheService: NotionCacheService
  private saver: NotionPageSaver
  private config: {
    recursive?: boolean
    includeImages?: boolean
    concurrency?: number
    logLevel?: LogLevel
  }

  /**
   * @param options 构造函数配置选项
   * @param options.fetcher 数据获取器
   * @param options.cacheService 缓存服务
   * @param options.saver 保存器
   * @param options.config 配置对象
   */
  constructor(options: {
    fetcher: NotionDataFetcher
    cacheService: NotionCacheService
    saver: NotionPageSaver
    config?: {
      recursive?: boolean
      includeImages?: boolean
      concurrency?: number
      logLevel?: LogLevel
    }
  }) {
    this.fetcher = options.fetcher
    this.cacheService = options.cacheService
    this.saver = options.saver
    this.config = options.config || {}

    this.fileDownloader = new NotionFileDownloader(this.saver.getOutputDir())
    // 设置默认值
    this.config.recursive = this.config.recursive ?? true
    this.config.includeImages = this.config.includeImages ?? false
    this.config.concurrency = this.config.concurrency ?? 5
    this.config.logLevel = this.config.logLevel ?? LogLevel.level0

    // 设置日志级别
    logger.setLogLevel(this.config.logLevel)
    // 同时也设置NotionLogger的日志级别
    NotionLogger.getNotionInstance().setLogLevel(this.config.logLevel)
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
            url: imageUrl,
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
   * @param options 处理页面的配置选项
   * @param options.pageId 页面ID
   * @param options.parentPageIds 父页面ID链
   */
  async processPage(options: { pageId: string; parentPageIds?: string[] }): Promise<void> {
    const { pageId, parentPageIds = [] } = options

    try {
      NotionLogger.processStart(pageId, parentPageIds)

      // 1. 获取页面数据
      const pageData = await this.fetcher.fetchPageData({ pageId })

      // 2. 检查缓存
      const needsUpdate = await this.cacheService.shouldUpdate({
        pageId,
        lastEditedTime: pageData.last_edited_time,
        parentPageIds,
      })

      if (!needsUpdate) {
        NotionLogger.useCache(pageId)
        return
      }

      // 3. 获取完整数据
      NotionLogger.fetchData(pageId)
      const fullData = await this.fetcher.fetchFullPageData({ pageId })

      // 4. 保存数据
      NotionLogger.saveData(pageId)
      const saveResult = await this.saver.savePageData({
        pageId,
        data: fullData,
        parentPageIds,
      })
      if (!saveResult.success) {
        throw new Error(`保存页面 ${pageId} 失败: ${saveResult.error}`)
      }

      // 5. 下载图片（如果配置允许）
      if (this.config.includeImages) {
        const imageUrls = this.extractImageUrls(fullData.children)
        if (imageUrls.length > 0) {
          NotionLogger.downloadFiles(pageId, imageUrls.length)
          await this.fileDownloader.saveFiles({
            pageId,
            files: imageUrls,
            options: {
              logLevel: this.config.logLevel,
            },
          })
        }
      }

      // 6. 处理子页面
      if (this.config.recursive) {
        const childPages = fullData.children.filter(block => isChildPage(block))
        if (childPages.length > 0) {
          NotionLogger.childPages(pageId, childPages.length)

          if (!this.config.concurrency || this.config.concurrency <= 0) {
            // 串行处理
            const startTime = process.hrtime.bigint()
            for (const childPage of childPages) {
              await this.processPage({
                pageId: childPage.id,
                parentPageIds: [...parentPageIds, pageId],
              })
            }
            const timeUsed = (Number(process.hrtime.bigint() - startTime) / 1_000_000).toFixed(2)
            NotionLogger.serialComplete(pageId, childPages.length, timeUsed)
          } else {
            // 并发处理
            NotionLogger.concurrentProcess(this.config.concurrency, childPages.length)
            const startTime = process.hrtime.bigint()

            // 分批处理子页面
            for (let i = 0; i < childPages.length; i += this.config.concurrency) {
              const batch = childPages.slice(i, i + this.config.concurrency)
              const promises = batch.map(childPage =>
                this.processPage({
                  pageId: childPage.id,
                  parentPageIds: [...parentPageIds, pageId],
                })
              )
              await Promise.all(promises)
            }

            const timeUsed = (Number(process.hrtime.bigint() - startTime) / 1_000_000).toFixed(2)
            NotionLogger.concurrentComplete(pageId, childPages.length, timeUsed)
          }
        }
      }
    } catch (error) {
      NotionLogger.error(pageId, error)
      throw error
    }
  }
}
