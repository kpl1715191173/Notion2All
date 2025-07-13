import { promises as fs } from 'fs'
import path from 'path'
import { createHash } from 'crypto'

import { NotionBackupLogger } from '@notion2all/utils'
import { PageObject } from '../types'
import { formatId } from '../utils'
import { NotionDataFetcher } from './fetcher'

/**
 * 缓存映射类型
 */
interface CacheMap {
  version: number
  pages: Record<string, PageCacheItem>
}

/**
 * 页面缓存项类型
 */
interface PageCacheItem {
  id?: string
  last_edited_time: string
  content_hash?: string // 新增：内容哈希值，用于更精确的变更检测
  children: PageCacheItem[] // 保持children为必填属性，简化代码
}

/**
 * Notion 缓存服务
 * 负责管理页面数据的本地缓存
 */
export class NotionCacheService {
  private cacheDir: string
  private cacheMapPath: string
  private cacheMap: CacheMap
  private pendingUpdates: Set<string> // 新增：待更新的页面ID集合
  private fetcher?: NotionDataFetcher // 添加fetcher属性
  private updatedChildPages: Map<string, string[]> = new Map() // 记录每个父页面ID下需要更新的子页面ID列表

  constructor(outputDir: string, fetcher?: NotionDataFetcher) {
    this.cacheDir = path.join(outputDir, '.cache')
    this.cacheMapPath = path.join(outputDir, '.cache', 'cache-map.json')
    this.cacheMap = {
      version: 1,
      pages: {},
    }
    this.pendingUpdates = new Set<string>()
    this.fetcher = fetcher // 初始化fetcher
    this.initCacheMap()
  }

  private async initCacheMap(): Promise<void> {
    try {
      await this.ensureDirectoryExists(this.cacheDir)
      const exists = await this.checkFileExists(this.cacheMapPath)
      if (exists) {
        const content = await fs.readFile(this.cacheMapPath, 'utf-8')
        this.cacheMap = JSON.parse(content)

        // 兼容旧版格式：如果children是对象形式，转换为数组形式
        for (const pageId in this.cacheMap.pages) {
          const page = this.cacheMap.pages[pageId]
          // 确保每个页面都有children数组
          if (!page.children) {
            page.children = []
          }
          // 检查children是否为对象而非数组
          else if (!Array.isArray(page.children)) {
            const oldChildren = page.children as unknown as Record<
              string,
              { last_edited_time: string }
            >
            const newChildren: PageCacheItem[] = []

            for (const childId in oldChildren) {
              newChildren.push({
                id: childId,
                last_edited_time: oldChildren[childId].last_edited_time,
                children: [],
              })
            }

            page.children = newChildren
          }
          // 确保每个子页面都有id属性
          if (page.id === undefined) {
            page.id = pageId
          }
        }

        // 移除独立的子页面项（确保页面只在父页面的子页面列表中出现一次）
        this.cleanupDuplicatePages()
      } else {
        await this.saveCacheMap()
      }
    } catch (error) {
      NotionBackupLogger.error(
        'cache',
        `初始化缓存映射失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 清理重复页面，确保子页面不会在顶层重复出现
   */
  private cleanupDuplicatePages(): void {
    // 收集所有子页面的ID
    const childPageIds = new Set<string>()

    for (const pageId in this.cacheMap.pages) {
      // 递归收集所有子页面ID
      this.collectChildPageIds(this.cacheMap.pages[pageId].children, childPageIds)
    }

    // 从顶层移除同时也是子页面的页面
    for (const childId of childPageIds) {
      if (this.cacheMap.pages[childId]) {
        NotionBackupLogger.cacheLog(`[缓存清理] 移除重复页面 ${childId}`)
        delete this.cacheMap.pages[childId]
      }
    }
  }

  /**
   * 递归收集所有子页面ID
   */
  private collectChildPageIds(children: PageCacheItem[], result: Set<string>): void {
    for (const child of children) {
      if (child.id) {
        result.add(child.id)
      }

      // 递归处理子页面的子页面
      if (child.children && child.children.length > 0) {
        this.collectChildPageIds(child.children, result)
      }
    }
  }

  private async saveCacheMap(): Promise<void> {
    try {
      await this.ensureDirectoryExists(path.dirname(this.cacheMapPath))
      await fs.writeFile(this.cacheMapPath, JSON.stringify(this.cacheMap, null, 2), 'utf-8')
    } catch (error) {
      NotionBackupLogger.error(
        'cache',
        `保存缓存映射失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 获取特定父页面下需要更新的子页面ID列表
   * @param parentId 父页面ID
   * @returns 需要更新的子页面ID数组
   */
  getUpdatedChildPages(parentId: string): string[] {
    const formattedParentId = formatId(parentId)
    return this.updatedChildPages.get(formattedParentId) || []
  }

  /**
   * 清除特定父页面的更新子页面记录
   * @param parentId 父页面ID
   */
  clearUpdatedChildPages(parentId: string): void {
    const formattedParentId = formatId(parentId)
    this.updatedChildPages.delete(formattedParentId)
  }

  /**
   * 检查页面是否需要更新
   * @param config.pageId 页面ID
   * @param config.lastEditedTime 最后编辑时间
   * @param config.parentPageIds 父页面ID链
   * @returns 是否需要更新
   */
  async shouldUpdate(config: {
    pageId: string
    lastEditedTime: string
    parentPageIds?: string[]
  }): Promise<boolean> {
    const { pageId, lastEditedTime, parentPageIds = [] } = config
    try {
      // 强制重新加载缓存映射
      await this.initCacheMap()

      const formattedPageId = formatId(pageId)

      // 如果页面已在待更新列表中，无需重复检查
      if (this.pendingUpdates.has(formattedPageId)) {
        NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 已在更新队列中`)
        return true
      }

      // 检查当前页面是否为顶层页面
      const isTopLevelPage = parentPageIds.length === 0

      if (!isTopLevelPage) {
        // 子页面情况，需要在父页面链中查找
        const childInfo = this.findChildInParentChain(formattedPageId, parentPageIds)

        if (childInfo) {
          // 首先比较时间戳，快速确定是否可能有更改
          const needsUpdate = childInfo.last_edited_time !== lastEditedTime

          if (!needsUpdate) {
            NotionBackupLogger.cacheLog(`[缓    存] 子页面 ${pageId} 使用缓存，内容未变更`)
            return false
          }

          // 如果时间戳不同，但存在内容哈希，进一步比较哈希值
          if (childInfo.content_hash) {
            // 获取当前页面数据并计算哈希值以进行比较
            const cachedData = await this.getCachedData({ pageId, parentPageIds })
            if (cachedData) {
              const currentHash = this.calculateContentHash(cachedData)
              if (childInfo.content_hash === currentHash) {
                NotionBackupLogger.cacheLog(
                  `[缓    存] 子页面 ${pageId} 使用缓存，时间戳变更但内容相同`
                )
                return false
              }
            }
          }

          NotionBackupLogger.cacheLog(`[缓    存] 子页面 ${pageId} 需要更新，最后编辑时间已变更`)
          this.pendingUpdates.add(formattedPageId)
          return true
        }
      }
      // 如果是顶层页面，检查自身和所有子页面
      else if (this.cacheMap.pages[formattedPageId]) {
        const cachedItem = this.cacheMap.pages[formattedPageId]

        // 首先比较时间戳，快速确定是否可能有更改
        let needsUpdate = cachedItem.last_edited_time !== lastEditedTime

        if (!needsUpdate) {
          // 顶层页面时间戳未变，检查所有子页面是否有更新
          const updatedChildIds = await this.checkChildrenUpdates(
            formattedPageId,
            cachedItem.children
          )

          if (updatedChildIds.length > 0) {
            // 记录需要更新的子页面ID，但不将父页面标记为需要更新
            this.updatedChildPages.set(formattedPageId, updatedChildIds)
            NotionBackupLogger.cacheLog(
              `[缓    存] 页面 ${pageId} 的子页面有 ${updatedChildIds.length} 个更新，但父页面本身不需重新获取`
            )
            return false
          }

          NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 使用缓存，内容未变更`)
          return false
        }

        // 如果时间戳不同，但存在内容哈希，进一步比较哈希值
        if (cachedItem.content_hash) {
          const cachedData = await this.getCachedData({ pageId })
          if (cachedData) {
            const currentHash = this.calculateContentHash(cachedData)
            if (cachedItem.content_hash === currentHash) {
              // 即使哈希值相同，仍需检查子页面
              const updatedChildIds = await this.checkChildrenUpdates(
                formattedPageId,
                cachedItem.children
              )

              if (updatedChildIds.length > 0) {
                // 记录需要更新的子页面ID，但不将父页面标记为需要更新
                this.updatedChildPages.set(formattedPageId, updatedChildIds)
                NotionBackupLogger.cacheLog(
                  `[缓    存] 页面 ${pageId} 的子页面有 ${updatedChildIds.length} 个更新，但父页面本身不需重新获取`
                )
                return false
              }

              NotionBackupLogger.cacheLog(
                `[缓    存] 页面 ${pageId} 使用缓存，时间戳变更但内容相同`
              )
              return false
            }
          }
        }

        NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 需要更新，最后编辑时间已变更`)
        this.pendingUpdates.add(formattedPageId)
        return true
      }

      // 缓存中找不到页面，需要更新
      NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 在缓存中不存在，需要获取`)
      this.pendingUpdates.add(formattedPageId)
      return true
    } catch (error) {
      NotionBackupLogger.error(
        'cache',
        `检查页面 ${pageId} 是否需要更新失败: ${error instanceof Error ? error.message : String(error)}`
      )
      return true
    }
  }

  /**
   * 批量检查多个页面是否需要更新
   * 适用于一次性预检查大量页面
   * @param pages 页面信息数组
   * @returns 需要更新的页面ID数组
   */
  async batchShouldUpdate(
    pages: Array<{
      pageId: string
      lastEditedTime: string
      parentPageIds?: string[]
    }>
  ): Promise<string[]> {
    // 强制重新加载缓存映射
    await this.initCacheMap()

    const needsUpdateIds: string[] = []
    const promises = pages.map(async page => {
      const needsUpdate = await this.shouldUpdate(page)
      if (needsUpdate) {
        needsUpdateIds.push(page.pageId)
      }
    })

    await Promise.all(promises)
    return needsUpdateIds
  }

  /**
   * 在父页面链中查找子页面
   * @returns 找到的子页面信息，如果未找到则返回null
   */
  private findChildInParentChain(childId: string, parentPageIds: string[]): PageCacheItem | null {
    if (parentPageIds.length === 0) return null

    // 从最上层父页面开始
    let currentParentId = formatId(parentPageIds[0])
    let parentPage = this.cacheMap.pages[currentParentId]

    if (!parentPage) return null

    // 构建页面链，从顶层父页面到直接父页面
    for (let i = 1; i < parentPageIds.length; i++) {
      const nextParentId = formatId(parentPageIds[i])
      // 在当前父页面的子页面中查找下一级父页面
      const nextParent = this.findChildPageById(parentPage.children, nextParentId)

      if (!nextParent) return null

      // 移动到下一级父页面
      currentParentId = nextParentId
      parentPage = nextParent
    }

    // 在最后一级父页面中查找目标子页面
    return this.findChildPageById(parentPage.children, childId)
  }

  /**
   * 在页面列表中查找特定ID的页面
   */
  private findChildPageById(children: PageCacheItem[], childId: string): PageCacheItem | null {
    if (!children || children.length === 0) return null

    for (const child of children) {
      if (child.id === childId) {
        return child
      }

      // 递归查找子页面的子页面
      if (child.children && child.children.length > 0) {
        const found = this.findChildPageById(child.children, childId)
        if (found) return found
      }
    }

    return null
  }

  /**
   * 计算页面内容的哈希值
   * 用于更精确地判断页面内容是否实际发生变化
   */
  private calculateContentHash(pageData: PageObject): string {
    // 创建一个包含关键内容的对象，忽略时间戳和其他非内容字段
    const contentObject = {
      title: pageData.title,
      icon: pageData.icon,
      cover: pageData.cover,
      properties: pageData.properties,
      // 只保留子块的id和type，不包括完整内容
      children: Array.isArray(pageData.children)
        ? pageData.children.map(child => ({
            id: child.id,
            type: child.type,
            // 对于内嵌子页面，只保留其ID
            has_children: child.has_children,
          }))
        : [],
    }

    // 计算内容的哈希值
    const contentStr = JSON.stringify(contentObject)
    return createHash('md5').update(contentStr).digest('hex')
  }

  /**
   * 更新页面的缓存状态
   * @param config.pageId 页面ID
   * @param config.data 页面数据
   * @param config.parentPageIds 父页面ID链
   */
  async updateCache(config: {
    pageId: string
    data: PageObject
    parentPageIds?: string[]
  }): Promise<void> {
    const { pageId, data, parentPageIds = [] } = config
    try {
      const formattedPageId = formatId(pageId)
      // 计算内容哈希值
      const contentHash = this.calculateContentHash(data)

      if (parentPageIds.length > 0) {
        // 多层嵌套的子页面更新
        await this.updateChildInParentChain(
          formattedPageId,
          data.last_edited_time,
          parentPageIds,
          contentHash // 新增传递内容哈希值
        )
        NotionBackupLogger.cacheLog(`[缓    存] 更新子页面 ${pageId} 的缓存记录`)
      } else {
        // 顶层页面更新
        if (!this.cacheMap.pages[formattedPageId]) {
          this.cacheMap.pages[formattedPageId] = {
            id: formattedPageId,
            last_edited_time: data.last_edited_time,
            content_hash: contentHash, // 新增内容哈希值
            children: [],
          }
        } else {
          this.cacheMap.pages[formattedPageId].last_edited_time = data.last_edited_time
          this.cacheMap.pages[formattedPageId].content_hash = contentHash // 更新内容哈希值
        }

        NotionBackupLogger.cacheLog(`[缓    存] 更新页面 ${pageId} 的缓存记录`)
      }

      // 更新完成后从待更新列表中移除
      this.pendingUpdates.delete(formattedPageId)

      await this.saveCacheMap()
    } catch (error) {
      NotionBackupLogger.error(
        'cache',
        `更新页面 ${pageId} 缓存失败: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * 在父页面链中更新或添加子页面
   */
  private async updateChildInParentChain(
    childId: string,
    lastEditedTime: string,
    parentPageIds: string[],
    contentHash?: string // 新增内容哈希参数
  ): Promise<void> {
    if (parentPageIds.length === 0) return

    // 获取最上层父页面
    const topParentId = formatId(parentPageIds[0])
    if (!this.cacheMap.pages[topParentId]) {
      this.cacheMap.pages[topParentId] = {
        id: topParentId,
        last_edited_time: '',
        children: [],
      }
    }

    // 递归构建和更新页面链
    let currentParentRef = this.cacheMap.pages[topParentId]

    // 遍历父页面链，确保每一级父页面都存在
    for (let i = 1; i < parentPageIds.length; i++) {
      const nextParentId = formatId(parentPageIds[i])

      // 在当前父页面的子页面中查找下一级父页面
      let childIndex = currentParentRef.children.findIndex(child => child.id === nextParentId)

      if (childIndex >= 0) {
        // 已存在该子页面
      } else {
        // 不存在，添加新的子页面
        childIndex = currentParentRef.children.length
        currentParentRef.children.push({
          id: nextParentId,
          last_edited_time: '',
          children: [],
        })
      }

      // 移动到下一级父页面
      currentParentRef = currentParentRef.children[childIndex]
    }

    // 现在currentParentRef是最后一级父页面，更新目标子页面
    const finalChildIndex = currentParentRef.children.findIndex(child => child.id === childId)

    if (finalChildIndex >= 0) {
      // 更新现有记录
      currentParentRef.children[finalChildIndex].last_edited_time = lastEditedTime
      if (contentHash) {
        currentParentRef.children[finalChildIndex].content_hash = contentHash
      }
    } else {
      // 添加新记录
      currentParentRef.children.push({
        id: childId,
        last_edited_time: lastEditedTime,
        content_hash: contentHash, // 可能为undefined
        children: [], // 为潜在的子子页面添加空数组
      })
    }
  }

  /**
   * 获取缓存的页面数据
   * @param config.pageId 页面ID
   * @param config.parentPageIds 父页面ID链
   * @returns 缓存的页面数据，如果不存在则返回 null
   */
  async getCachedData(config: {
    pageId: string
    parentPageIds?: string[]
  }): Promise<PageObject | null> {
    const { pageId, parentPageIds = [] } = config
    try {
      const formattedIds = parentPageIds.map(id => formatId(id))
      const formattedPageId = formatId(pageId)
      const filePath = path.join(
        this.cacheDir,
        ...formattedIds,
        formattedPageId,
        `${formattedPageId}.json`
      )

      const fileContent = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(fileContent)
    } catch (error) {
      NotionBackupLogger.cacheLog(`[缓存读取] 页面 ${pageId} 本地文件不存在或读取失败`)
      return null
    }
  }

  /**
   * 检查文件是否存在
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(directory: string): Promise<void> {
    try {
      await fs.mkdir(directory, { recursive: true })
    } catch (error) {
      // 如果目录已经存在，忽略错误
    }
  }

  /**
   * 递归检查子页面是否有更新
   * @param parentId 父页面ID
   * @param children 子页面数组
   * @returns 需要更新的子页面ID数组
   */
  private async checkChildrenUpdates(
    parentId: string,
    children: PageCacheItem[]
  ): Promise<string[]> {
    if (!children || children.length === 0) {
      return []
    }

    const updatedChildIds: string[] = []

    // 遍历每个直接子页面
    for (const child of children) {
      if (!child.id) continue

      try {
        // 尝试获取子页面的最新信息
        const childPageData = await this.fetcher?.fetchPageData({ pageId: child.id })
        if (!childPageData) continue

        // 比较时间戳
        if (childPageData.last_edited_time !== child.last_edited_time) {
          NotionBackupLogger.cacheLog(
            `[缓    存] 发现子页面 ${child.id} 有更新，父页面 ${parentId} 不需要重新获取，只更新子页面`
          )
          updatedChildIds.push(child.id)
        }

        // 递归检查更深层次的子页面
        const nestedUpdatedChildIds = await this.checkChildrenUpdates(child.id, child.children)
        if (nestedUpdatedChildIds.length > 0) {
          // 如果嵌套的子页面有更新，需要更新当前子页面
          if (!updatedChildIds.includes(child.id)) {
            updatedChildIds.push(child.id)
          }

          // 记录这些更深层次的子页面，它们会作为当前子页面的子页面被处理
          this.updatedChildPages.set(child.id, nestedUpdatedChildIds)
        }
      } catch (error) {
        NotionBackupLogger.error(
          'cache',
          `检查子页面 ${child.id} 更新失败: ${error instanceof Error ? error.message : String(error)}`
        )
        // 检查失败当作需要更新处理
        updatedChildIds.push(child.id)
      }
    }

    return updatedChildIds
  }
}
