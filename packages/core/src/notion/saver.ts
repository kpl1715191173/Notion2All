import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { PageObject, SaveResult } from './types'

/**
 * Notion 页面数据保存器
 * 负责将页面数据保存到本地文件系统
 */
export class NotionPageSaver {
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
   * 确保输出目录存在
   * @param dirPath 目录路径
   * @throws 如果创建目录失败且错误不是目录已存在
   */
  private async ensureOutputDir(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new Error(
          `创建输出目录失败: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }
  }

  /**
   * 保存页面数据到文件
   * @param pageId 页面ID
   * @param data 页面数据
   * @param parentPageIds 父页面ID链
   * @returns 保存结果
   */
  async savePageData(
    pageId: string,
    data: PageObject,
    parentPageIds: string[] = []
  ): Promise<SaveResult> {
    try {
      const formattedIds = parentPageIds.map(id => this.formatPageId(id))
      const formattedPageId = this.formatPageId(pageId)
      const pageDir = path.join(this.outputDir, ...formattedIds, formattedPageId)
      const filePath = path.join(pageDir, `${formattedPageId}.json`)

      await this.ensureOutputDir(pageDir)
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

      return {
        success: true,
        filePath,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}
