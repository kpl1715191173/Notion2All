import { readFile } from 'fs/promises'
import path from 'path'
import { PageObject } from './types'

/**
 * Notion 缓存服务
 * 负责管理页面数据的本地缓存
 */
export class NotionCacheService {
  constructor(private outputDir: string) {}

  /**
   * 格式化页面 ID，确保使用带连字符的格式
   * @param pageId 页面ID
   * @returns 格式化后的页面ID
   */
  private formatPageId(pageId: string): string {
    if (pageId.includes('-')) return pageId
    return pageId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
  }

  /**
   * 检查页面是否需要更新
   * @param pageId 页面ID
   * @param lastEditedTime 页面的最后编辑时间
   * @param parentPageIds 父页面ID链
   * @returns 是否需要更新
   */
  async shouldUpdate(
    pageId: string,
    lastEditedTime: string,
    parentPageIds: string[] = []
  ): Promise<boolean> {
    try {
      const formattedIds = parentPageIds.map(id => this.formatPageId(id))
      const formattedPageId = this.formatPageId(pageId)
      const filePath = path.join(
        this.outputDir,
        ...formattedIds,
        formattedPageId,
        `${formattedPageId}.json`
      )

      const fileContent = await readFile(filePath, 'utf-8')
      const localData = JSON.parse(fileContent)

      const needsUpdate = localData.last_edited_time !== lastEditedTime
      console.log(
        `[缓存检查] 页面 ${pageId}:\n` +
          `  本地时间: ${localData.last_edited_time}\n` +
          `  远程时间: ${lastEditedTime}\n` +
          `  需要更新: ${needsUpdate ? '是' : '否'}`
      )
      return needsUpdate
    } catch (error) {
      console.log(`[缓存检查] 页面 ${pageId} 本地文件不存在或读取失败，需要更新`)
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
      const formattedIds = parentPageIds.map(id => this.formatPageId(id))
      const formattedPageId = this.formatPageId(pageId)
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
