import { NotionBackupLogger, IndentLevel } from '@notion2all/utils'
import { promises as fs } from 'fs'
import path from 'path'
import { PageObject } from '../types'
import { formatId } from '../utils'

/**
 * Notion 缓存服务
 * 负责管理页面数据的本地缓存
 */
export class NotionCacheService {
  private cacheDir: string

  constructor(outputDir: string) {
    this.cacheDir = path.join(outputDir, '.cache')
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
      const cachePath = this.getCachePath({ pageId, parentIds: parentPageIds })
      const cacheExists = await this.checkCacheExists(cachePath)

      if (!cacheExists) {
        NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 没有缓存记录`)
        return true
      }

      const cacheData = await this.readCache(cachePath)
      const needsUpdate = cacheData.last_edited_time !== lastEditedTime

      if (needsUpdate) {
        NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 需要更新，最后编辑时间已变更`)
      } else {
        NotionBackupLogger.cacheLog(`[缓    存] 页面 ${pageId} 使用缓存，内容未变更`)
      }

      return needsUpdate
    } catch (error) {
      NotionBackupLogger.error(pageId, error)
      return true
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

  private getCachePath(config: { pageId: string; parentIds?: string[] }): string {
    const { pageId, parentIds = [] } = config
    const relativePath = parentIds.length > 0 ? path.join(...parentIds, pageId) : pageId
    return path.join(this.cacheDir, `${relativePath}.json`)
  }

  private async checkCacheExists(cachePath: string): Promise<boolean> {
    try {
      await fs.access(cachePath)
      return true
    } catch {
      return false
    }
  }

  private async readCache(cachePath: string): Promise<any> {
    try {
      const content = await fs.readFile(cachePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      NotionBackupLogger.error('cache', error)
      throw error
    }
  }
}
