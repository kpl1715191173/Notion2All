import { NotionDataFetcher } from './fetcher'
import { NotionCacheService } from './cache'
import { NotionPageSaver } from './saver'
import { NotionFileDownloader } from './file-downloader'
import { isChildPage, logger, LogLevel, NotionBackupLogger, Logger } from '@notion2all/utils'

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
  }
  private logger?: NotionBackupLogger
  // 资源映射表，记录每个资源ID对应的原始页面ID
  private resourcePageMap: Map<string, string> = new Map()

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
    config: {
      recursive: boolean
      includeImages: boolean
      concurrency: number
    }
  }) {
    this.fetcher = options.fetcher
    this.cacheService = options.cacheService
    this.saver = options.saver
    this.config = options.config || {}

    this.fileDownloader = new NotionFileDownloader(this.saver.getOutputDir())
  }

  /**
   * 从块中提取图片信息并记录资源所属页面
   * @param blocks 块数组
   * @param pageId 当前页面ID
   * @param recordOnly 是否仅记录资源映射而不返回图片信息
   * @returns 图片信息数组
   */
  private extractImageUrls(
    blocks: any[], 
    pageId: string, 
    recordOnly: boolean = false
  ): Array<{ blockId: string; url: string }> {
    const images: Array<{ blockId: string; url: string }> = []

    for (const block of blocks) {
      // 跳过子页面块，它们的图片会在处理子页面时单独提取和记录
      if (isChildPage(block)) {
        continue
      }
      
      if (block.type === 'image') {
        const imageUrl = block[block.type]?.file?.url || block[block.type]?.external?.url
        if (imageUrl) {
          // 记录资源ID与页面ID的对应关系，如果之前没有记录过
          if (!this.resourcePageMap.has(block.id)) {
            this.resourcePageMap.set(block.id, pageId)
          }
          
          // 如果当前页面是该资源的所属页面，并且不是仅记录模式，则添加到图片列表中
          if (!recordOnly && this.resourcePageMap.get(block.id) === pageId) {
            images.push({
              blockId: block.id,
              url: imageUrl,
            })
          }
        }
      }

      // 递归处理子块（非子页面的子块）
      if (block.children && Array.isArray(block.children)) {
        const childImages = this.extractImageUrls(block.children, pageId, recordOnly)
        if (!recordOnly) {
          images.push(...childImages)
        }
      }
    }

    return images
  }

  /**
   * 预处理所有页面，构建资源映射表
   * @param pageId 当前页面ID
   * @param data 页面数据
   */
  private async buildResourceMap(pageId: string, data: any): Promise<void> {
    // 记录当前页面的资源
    this.extractImageUrls(data.children, pageId, true)
    
    // 递归预处理子页面
    const childPages = data.children.filter((block: any) => isChildPage(block))
    for (const childPage of childPages) {
      const childData = await this.fetcher.fetchFullPageData({ pageId: childPage.id })
      await this.buildResourceMap(childPage.id, childData)
    }
  }

  /**
   * 处理页面及其子页面
   * @param options 处理页面的配置选项
   * @param options.pageId 页面ID
   * @param options.parentPageIds 父页面ID链
   * @param options.isRoot 是否是根页面
   */
  async processPage(options: { 
    pageId: string; 
    parentPageIds?: string[];
    isRoot?: boolean;
  }): Promise<void> {
    const { pageId, parentPageIds = [], isRoot = false } = options

    try {
      NotionBackupLogger.processStart(pageId, parentPageIds)

      // 1. 获取页面数据
      const pageData = await this.fetcher.fetchPageData({ pageId })

      // 2. 检查缓存
      const needsUpdate = await this.cacheService.shouldUpdate({
        pageId,
        lastEditedTime: pageData.last_edited_time,
        parentPageIds,
      })

      if (!needsUpdate) {
        NotionBackupLogger.useCache(pageId)
        return
      }

      // 3. 获取完整数据
      const fullData = await this.fetcher.fetchFullPageData({ pageId })

      // 如果是根页面，先预构建整个资源映射表
      if (isRoot && this.config.includeImages) {
        NotionBackupLogger.cacheLog(`[资源映射] 开始构建全局资源映射表`)
        await this.buildResourceMap(pageId, fullData)
        NotionBackupLogger.cacheLog(`[资源映射] 资源映射表构建完成，共 ${this.resourcePageMap.size} 个资源`)
      }

      // 4. 保存数据
      NotionBackupLogger.saveData(pageId)
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
        // 提取属于当前页面的图片
        const imageUrls = this.extractImageUrls(fullData.children, pageId)
        if (imageUrls.length > 0) {
          NotionBackupLogger.downloadFiles(pageId, imageUrls.length)
          await this.fileDownloader.saveFiles({
            pageId,
            files: imageUrls,
            parentPageIds,
          })
        }
      }

      // 6. 处理子页面
      if (this.config.recursive) {
        const childPages = fullData.children.filter(block => isChildPage(block))
        if (childPages.length > 0) {
          NotionBackupLogger.childPages(pageId, childPages.length)

          if (!this.config.concurrency || this.config.concurrency <= 0) {
            // 串行处理
            const startTime = process.hrtime.bigint()
            for (const childPage of childPages) {
              await this.processPage({
                pageId: childPage.id,
                parentPageIds: [...parentPageIds, pageId],
                isRoot: false
              })
            }
            const timeUsed = (Number(process.hrtime.bigint() - startTime) / 1_000_000).toFixed(2)
            NotionBackupLogger.serialComplete(pageId, childPages.length, timeUsed)
          } else {
            // 并发处理
            NotionBackupLogger.concurrentProcess(this.config.concurrency, childPages.length)
            const startTime = process.hrtime.bigint()

            // 分批处理子页面
            for (let i = 0; i < childPages.length; i += this.config.concurrency) {
              const batch = childPages.slice(i, i + this.config.concurrency)
              const promises = batch.map(childPage =>
                this.processPage({
                  pageId: childPage.id,
                  parentPageIds: [...parentPageIds, pageId],
                  isRoot: false
                })
              )
              await Promise.all(promises)
            }

            const timeUsed = (Number(process.hrtime.bigint() - startTime) / 1_000_000).toFixed(2)
            NotionBackupLogger.concurrentComplete(pageId, childPages.length, timeUsed)
          }
        }
      }
    } catch (error) {
      NotionBackupLogger.error(pageId, error)
      throw error
    }
  }
}
