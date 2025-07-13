import { NotionBackupLogger, isChildPage } from '@notion2all/utils'
import { NotionBlock, PageObject } from '../types'
import { NotionDataFetcher } from './fetcher'
import { NotionPageSaver } from './saver'
import { NotionFileDownloader } from './file-downloader'
import { NotionCacheService } from './cache'

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

      // 检查是否有需要更新的子页面，即使父页面本身不需要更新
      const updatedChildPageIds = needsUpdate ? [] : this.cacheService.getUpdatedChildPages(pageId)
      
      if (!needsUpdate && updatedChildPageIds.length === 0) {
        NotionBackupLogger.useCache(pageId)
        return
      } else if (!needsUpdate && updatedChildPageIds.length > 0) {
        NotionBackupLogger.cacheLog(`[增量更新] 页面 ${pageId} 本身使用缓存，但有 ${updatedChildPageIds.length} 个子页面需要更新`)
        
        // 只获取缓存的父页面数据，不重新下载
        const cachedPageData = await this.cacheService.getCachedData({ pageId, parentPageIds })
        
        if (!cachedPageData) {
          NotionBackupLogger.error(pageId, `无法获取缓存的页面数据，将完整重新下载`)
          needsUpdate = true // 回退到完整更新
        } else {
          // 单独处理每个需要更新的子页面
          await this.processUpdatedChildPages(cachedPageData, pageId, parentPageIds, updatedChildPageIds)
          
          // 清除已处理的子页面记录
          this.cacheService.clearUpdatedChildPages(pageId)
          return
        }
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
   * 处理需要更新的子页面
   * 这个方法用于处理父页面不需要更新，但有子页面需要更新的情况
   */
  private async processUpdatedChildPages(
    parentPageData: PageObject,
    parentId: string,
    parentPageIds: string[],
    updatedChildIds: string[]
  ): Promise<void> {
    if (!parentPageData || !parentPageData.children || !updatedChildIds || updatedChildIds.length === 0) {
      return
    }
    
    NotionBackupLogger.cacheLog(`[子页面更新] 开始处理 ${parentId} 下的 ${updatedChildIds.length} 个子页面`)
    
    // 构建新的父页面链
    const newParentChain = [...parentPageIds, parentId]
    
    // 直接处理每个需要更新的子页面
    for (const childId of updatedChildIds) {
      await this.processPage({
        pageId: childId,
        parentPageIds: newParentChain,
        isRoot: false
      })
    }
    
    NotionBackupLogger.cacheLog(`[子页面更新] 完成处理 ${parentId} 下的所有需要更新的子页面`)
  }

  /**
   * 批量处理多个页面及其子页面
   * 使用优化的缓存检查策略
   * @param pageIds 要处理的页面ID数组
   * @param options 配置选项
   */
  async batchProcessPages(
    pageIds: string[], 
    options: { 
      concurrency?: number,
      parentPageIds?: string[] 
    } = {}
  ): Promise<void> {
    const { concurrency = 3, parentPageIds = [] } = options
    const enableCache = this.config.enableCache !== undefined ? this.config.enableCache : true
    
    try {
      NotionBackupLogger.cacheLog(`[批量处理] 开始处理 ${pageIds.length} 个页面`)
      
      if (pageIds.length === 0) return;
      
      // 步骤1: 获取所有页面的基本信息用于缓存检查
      const pageInfoPromises = pageIds.map(pageId => 
        this.fetcher.fetchPageData({ pageId })
          .then(data => ({
            pageId,
            lastEditedTime: data.last_edited_time,
            parentPageIds
          }))
          .catch(error => {
            NotionBackupLogger.error(pageId, `获取页面基本信息失败: ${error}`)
            return null
          })
      );
      
      const pageInfos = (await Promise.all(pageInfoPromises)).filter(Boolean) as Array<{
        pageId: string;
        lastEditedTime: string;
        parentPageIds: string[];
      }>;
      
      // 步骤2: 批量检查哪些页面需要更新
      let pagesToProcess = pageIds;
      if (enableCache && pageInfos.length > 0) {
        const needsUpdateIds = await this.cacheService.batchShouldUpdate(pageInfos);
        pagesToProcess = needsUpdateIds;
        
        NotionBackupLogger.cacheLog(`[缓存批量] 检查完成，共 ${pageIds.length} 个页面，需要更新 ${pagesToProcess.length} 个页面`);
      }
      
      // 步骤3: 并发处理需要更新的页面，控制并发数
      const processQueue = async (ids: string[]) => {
        const chunks = this.chunkArray(ids, concurrency);
        
        for (const chunk of chunks) {
          await Promise.all(
            chunk.map(pageId => this.processPage({ 
              pageId, 
              parentPageIds,
              isRoot: false // 在批处理中，所有页面都不是根页面，它们是作为其他页面的子页面被处理的
            }))
          );
        }
      };
      
      await processQueue(pagesToProcess);
      
      NotionBackupLogger.cacheLog(`[批量处理] 完成，共处理 ${pagesToProcess.length} 个页面`);
    } catch (error) {
      NotionBackupLogger.error('batch', `批量处理页面失败: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
  
  /**
   * 将数组分割成多个小块
   * 用于控制并发处理
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * 处理子页面（包括直接子页面和嵌套在普通块中的子页面）
   * 重构为使用优化的缓存检查方式
   */
  private async processChildPages(parentPageData: PageObject, parentId: string, parentPageIds: string[]): Promise<void> {
    // 收集所有子页面信息
    const childPages: Array<{ id: string; lastEditedTime: string }> = [];
    const newParentChain = [...parentPageIds, parentId];
    
    // 1. 收集当前页面的子页面
    if (parentPageData.children && Array.isArray(parentPageData.children)) {
      for (const block of parentPageData.children) {
        // 直接子页面
        if (isChildPage(block) && block.id) {
          childPages.push({
            id: block.id,
            lastEditedTime: block.last_edited_time || ''
          });
        }
        // 嵌套子页面：block 中包含子页面引用
        else if (block.has_children && block.children) {
          for (const subBlock of block.children) {
            if (isChildPage(subBlock) && subBlock.id) {
              childPages.push({
                id: subBlock.id,
                lastEditedTime: subBlock.last_edited_time || ''
              });
            }
          }
        }
      }
    }
    
    if (childPages.length === 0) {
      // 即使没有直接子页面，仍需处理嵌套在普通块中的子页面
      await this.processNestedChildPages(parentPageData.children, parentId, parentPageIds);
      return;
    }
    
    // 2. 批量处理子页面
    NotionBackupLogger.cacheLog(`[子页面] 页面 ${parentId} 包含 ${childPages.length} 个子页面`);
    
    // 使用优化的批量处理方法
    await this.batchProcessPages(
      childPages.map(page => page.id),
      { 
        concurrency: 3, // 并发数，可根据实际情况调整
        parentPageIds: newParentChain 
      }
    );
    
    // 3. 处理所有嵌套在普通块中的子页面
    await this.processNestedChildPages(parentPageData.children, parentId, parentPageIds);
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
