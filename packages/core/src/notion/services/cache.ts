import { NotionBackupLogger, IndentLevel } from '@notion2all/utils'
import { promises as fs } from 'fs'
import path from 'path'
import { PageObject } from '../types'
import { formatId } from '../utils'

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

  constructor(outputDir: string) {
    this.cacheDir = path.join(outputDir, '.cache')
    this.cacheMapPath = path.join(outputDir, '.cache', 'cache-map.json')
    this.cacheMap = {
      version: 1,
      pages: {}
    }
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
            const oldChildren = page.children as unknown as Record<string, { last_edited_time: string }>
            const newChildren: PageCacheItem[] = []
            
            for (const childId in oldChildren) {
              newChildren.push({
                id: childId,
                last_edited_time: oldChildren[childId].last_edited_time,
                children: []
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
      NotionBackupLogger.error('cache', `初始化缓存映射失败: ${error instanceof Error ? error.message : String(error)}`)
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
      NotionBackupLogger.error('cache', `保存缓存映射失败: ${error instanceof Error ? error.message : String(error)}`)
    }
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
      
      if (parentPageIds.length > 0) {
        // 子页面情况，需要在父页面链中查找
        const childInfo = this.findChildInParentChain(formattedPageId, parentPageIds)
        
        if (childInfo) {
          const needsUpdate = childInfo.last_edited_time !== lastEditedTime
          
          if (needsUpdate) {
            NotionBackupLogger.cacheLog(`[缓    存] 子页面 ${pageId} 需要更新，最后编辑时间已变更`)
          } else {
            NotionBackupLogger.cacheLog(`[缓    存] 子页面 ${pageId} 使用缓存，内容未变更`)
          }
          
          return needsUpdate
        }
      } 
      // 如果是父页面，直接查询pages中的记录
      else if (this.cacheMap.pages[formattedPageId]) {
        const cachedTime = this.cacheMap.pages[formattedPageId].last_edited_time
        const needsUpdate = cachedTime !== lastEditedTime
        
        if (needsUpdate) {
          NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 需要更新，最后编辑时间已变更`)
        } else {
          NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 使用缓存，内容未变更`)
        }
        
        return needsUpdate
      }
      
      // 缓存中找不到页面，需要更新
      NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 在缓存中不存在，需要获取`)
      return true
    } catch (error) {
      NotionBackupLogger.error('cache', `检查页面 ${pageId} 是否需要更新失败: ${error instanceof Error ? error.message : String(error)}`)
      return true
    }
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
      
      if (parentPageIds.length > 0) {
        // 多层嵌套的子页面更新
        await this.updateChildInParentChain(formattedPageId, data.last_edited_time, parentPageIds)
        NotionBackupLogger.cacheLog(`[缓    存] 更新子页面 ${pageId} 的缓存记录`)
      } else {
        // 顶层页面更新
        if (!this.cacheMap.pages[formattedPageId]) {
          this.cacheMap.pages[formattedPageId] = {
            id: formattedPageId,
            last_edited_time: data.last_edited_time,
            children: []
          }
        } else {
          this.cacheMap.pages[formattedPageId].last_edited_time = data.last_edited_time
        }
        
        NotionBackupLogger.cacheLog(`[缓    存] 更新页面 ${pageId} 的缓存记录`)
      }
      
      await this.saveCacheMap()
    } catch (error) {
      NotionBackupLogger.error('cache', `更新页面 ${pageId} 缓存失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  
  /**
   * 在父页面链中更新或添加子页面
   */
  private async updateChildInParentChain(childId: string, lastEditedTime: string, parentPageIds: string[]): Promise<void> {
    if (parentPageIds.length === 0) return
    
    // 获取最上层父页面
    const topParentId = formatId(parentPageIds[0])
    if (!this.cacheMap.pages[topParentId]) {
      this.cacheMap.pages[topParentId] = {
        id: topParentId,
        last_edited_time: '',
        children: []
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
          children: []
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
    } else {
      // 添加新记录
      currentParentRef.children.push({
        id: childId,
        last_edited_time: lastEditedTime,
        children: [] // 为潜在的子子页面添加空数组
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
}
