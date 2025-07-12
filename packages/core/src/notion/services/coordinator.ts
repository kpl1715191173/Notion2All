import { NotionDataFetcher } from './fetcher'
import { NotionCacheService } from './cache'
import { NotionPageSaver } from './saver'
import { NotionFileDownloader } from './file-downloader'
import { isChildPage, logger, LogLevel, NotionBackupLogger, Logger } from '@notion2all/utils'
import { NotionBlock, PageObject } from '../types'

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
    enableCache?: boolean
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
      enableCache?: boolean
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

    // 检查是否启用了缓存功能
    const enableCache = this.config.enableCache !== undefined ? this.config.enableCache : true

    try {
      NotionBackupLogger.processStart(pageId, parentPageIds)

      // 1. 获取页面数据
      const pageData = await this.fetcher.fetchPageData({ pageId })

      // 2. 检查缓存
      let needsUpdate = true
      if (enableCache) {
        needsUpdate = await this.cacheService.shouldUpdate({
          pageId,
          lastEditedTime: pageData.last_edited_time,
          parentPageIds,
        })
      } else {
        NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 缓存功能已禁用，将重新下载`)
      }

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

      // 5. 更新缓存记录
      if (enableCache) {
        await this.cacheService.updateCache({
          pageId,
          data: fullData,
          parentPageIds,
        })
      }

      // 6. 下载图片（如果配置允许）
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

      // 7. 处理子页面（包括直接子页面和嵌套在普通块中的子页面）
      if (this.config.recursive) {
        await this.processChildPages(fullData, pageId, parentPageIds);
      }
    } catch (error) {
      NotionBackupLogger.error(pageId, error)
      throw error
    }
  }

  /**
   * 处理所有子页面，包括直接子页面和嵌套在块中的子页面
   * @param data 页面数据
   * @param parentId 父页面ID
   * @param ancestorIds 祖先页面ID链
   */
  private async processChildPages(data: PageObject, parentId: string, ancestorIds: string[] = []): Promise<void> {
    if (!data.children || !Array.isArray(data.children)) {
      return;
    }

    // 先处理直接的子页面
    const directChildPages = data.children.filter((block: NotionBlock) => isChildPage(block));
    if (directChildPages.length > 0) {
      NotionBackupLogger.childPages(parentId, directChildPages.length);

      if (!this.config.concurrency || this.config.concurrency <= 0) {
        // 串行处理
        const startTime = process.hrtime.bigint();
        for (const childPage of directChildPages) {
          await this.processPage({
            pageId: childPage.id,
            parentPageIds: [...ancestorIds, parentId],
            isRoot: false
          });
        }
        const timeUsed = (Number(process.hrtime.bigint() - startTime) / 1_000_000).toFixed(2);
        NotionBackupLogger.serialComplete(parentId, directChildPages.length, timeUsed);
      } else {
        // 并发处理
        NotionBackupLogger.concurrentProcess(this.config.concurrency, directChildPages.length);
        const startTime = process.hrtime.bigint();

        // 分批处理子页面
        for (let i = 0; i < directChildPages.length; i += this.config.concurrency) {
          const batch = directChildPages.slice(i, i + this.config.concurrency);
          const promises = batch.map((childPage: NotionBlock) =>
            this.processPage({
              pageId: childPage.id,
              parentPageIds: [...ancestorIds, parentId],
              isRoot: false
            })
          );
          await Promise.all(promises);
        }

        const timeUsed = (Number(process.hrtime.bigint() - startTime) / 1_000_000).toFixed(2);
        NotionBackupLogger.concurrentComplete(parentId, directChildPages.length, timeUsed);
      }
    }

    // 递归处理嵌套在普通块中的子页面
    await this.processNestedChildPages(data.children, parentId, ancestorIds);
  }

  /**
   * 递归处理所有嵌套在普通块中的子页面
   * @param blocks 块列表
   * @param parentId 父页面ID
   * @param ancestorIds 祖先页面ID链
   */
  private async processNestedChildPages(blocks: NotionBlock[], parentId: string, ancestorIds: string[] = []): Promise<void> {
    for (const block of blocks) {
      // 跳过子页面块，它们已经在processChildPages中处理过了
      if (isChildPage(block)) {
        continue;
      }
      
      // 处理嵌套块
      if (block.children && Array.isArray(block.children)) {
        // 查找此块中的子页面
        const nestedChildPages = block.children.filter((child: NotionBlock) => isChildPage(child));
        if (nestedChildPages.length > 0) {
          NotionBackupLogger.log(
            `[嵌套页面] 在块 ${block.id} 中发现 ${nestedChildPages.length} 个嵌套子页面`,
            0
          );
          
          // 处理这些嵌套子页面
          for (const childPage of nestedChildPages) {
            await this.processPage({
              pageId: childPage.id,
              parentPageIds: [...ancestorIds, parentId],
              isRoot: false
            });
          }
        }
        
        // 继续递归处理更深层的块
        await this.processNestedChildPages(block.children, parentId, ancestorIds);
      }
    }
  }
}
