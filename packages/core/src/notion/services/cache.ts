import { logger, LogLevel } from '@notion2all/utils'
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
   * @param pageId 页面ID
   * @param lastEditedTime 最后编辑时间
   * @param parentPageIds 父页面ID链
   * @returns 是否需要更新
   */
  async shouldUpdate(
    pageId: string,
    lastEditedTime: string,
    parentPageIds: string[] = []
  ): Promise<boolean> {
    try {
      const cachePath = this.getCachePath(pageId, parentPageIds)
      const cacheExists = await this.checkCacheExists(cachePath)

      if (!cacheExists) {
        logger.log(`[缓存] 页面 ${pageId} 没有缓存记录`, LogLevel.level2)
        return true
      }

      const cacheData = await this.readCache(cachePath)
      const needsUpdate = cacheData.last_edited_time !== lastEditedTime

      if (needsUpdate) {
        logger.log(`[缓存] 页面 ${pageId} 需要更新，最后编辑时间已变更`, LogLevel.level2)
      } else {
        logger.log(`[缓存] 页面 ${pageId} 使用缓存，内容未变更`, LogLevel.level2)
      }

      return needsUpdate
    } catch (error) {
      logger.error(
        `[缓存] 检查页面 ${pageId} 缓存状态失败: ${error instanceof Error ? error.message : String(error)}`,
        LogLevel.level2
      )
      return true
    }
  }

  /**
   * 获取缓存的页面数据
   * @param pageId 页面ID
   * @param parentPageIds 父页面ID链
   * @returns 缓存的页面数据，如果不存在则返回 null
   */
  async getCachedData(pageId: string, parentPageIds: string[] = []): Promise<PageObject | null> {
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
      console.log(`[缓存读取] 页面 ${pageId} 本地文件不存在或读取失败`)
      return null
    }
  }

  private getCachePath(pageId: string, parentIds: string[] = []): string {
    const relativePath = parentIds.length > 0
      ? path.join(...parentIds, pageId)
      : pageId
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
      logger.error(
        `[缓存] 读取缓存文件失败: ${error instanceof Error ? error.message : String(error)}`,
        LogLevel.level2
      )
      throw error
    }
  }
} 