import { readFile } from 'fs/promises'
import path from 'path'
import { PageObject } from './types'
import { formatId } from './utils'

/**
 * Notion 缓存服务
 * 负责管理页面数据的本地缓存
 */
export class NotionCacheService {
  constructor(private outputDir: string) {}

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
    const cachedData = await this.getCachedData(pageId, parentPageIds)
    if (!cachedData) return true

    return new Date(cachedData.last_edited_time) < new Date(lastEditedTime)
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
        this.outputDir,
        ...formattedIds,
        formattedPageId,
        `${formattedPageId}.json`
      )

      const fileContent = await readFile(filePath, 'utf-8')
      return JSON.parse(fileContent)
    } catch (error) {
      console.log(`[缓存读取] 页面 ${pageId} 本地文件不存在或读取失败`)
      return null
    }
  }
}
