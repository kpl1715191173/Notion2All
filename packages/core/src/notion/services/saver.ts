import { NotionBackupLogger } from '@notion2all/utils'
import { promises as fs } from 'fs'
import path from 'path'
import { PageObject, SaveResult } from '../types'
import { formatId } from '../utils'

/**
 * Notion 页面数据保存器
 * 负责将页面数据保存到本地文件系统
 */
export class NotionPageSaver {
  private baseIndentLevel: number = 2 // 默认缩进基准级别

  constructor(private outputDir: string) {
    // 使用NotionBackupLogger的实例获取当前的缩进级别
    this.baseIndentLevel = NotionBackupLogger.getNotionInstance().getBaseIndentLevel()
  }

  /**
   * 获取输出目录路径
   * @returns 输出目录路径
   */
  getOutputDir(): string {
    return this.outputDir
  }

  /**
   * 保存页面数据到文件
   * @param config.pageId 页面ID
   * @param config.data 页面数据
   * @param config.parentPageIds 父页面ID链
   * @returns 保存结果
   */
  async savePageData(config: {
    pageId: string
    data: PageObject
    parentPageIds?: string[]
  }): Promise<SaveResult> {
    const { pageId, data, parentPageIds = [] } = config
    try {
      const formattedIds = parentPageIds.map(id => formatId(id))
      const formattedPageId = formatId(pageId)
      const pageDir = path.join(this.outputDir, ...formattedIds, formattedPageId)
      const filePath = path.join(pageDir, `${formattedPageId}.json`)

      await this.ensureDirectoryExists(path.dirname(filePath))

      this.saveLog(`[保    存] 保存页面 ${pageId} 到 ${filePath}`)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

      return {
        success: true,
        filePath,
      }
    } catch (error) {
      this.logError(pageId, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  private getSavePath(config: { pageId: string; parentIds?: string[] }): string {
    const { pageId, parentIds = [] } = config
    const relativePath = parentIds.length > 0 ? path.join(...parentIds, pageId) : pageId
    return path.join(this.outputDir, `${relativePath}.json`)
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath)
    } catch {
      this.saveLog(`[保    存] 创建目录 ${dirPath}`)
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  /**
   * 保存相关日志输出，使用缩进控制
   */
  private saveLog(message: string): void {
    // 类似于 cacheLog，使用专门的日志方法支持缩进
    NotionBackupLogger.cacheLog(message)
  }

  /**
   * 错误日志输出
   */
  private logError(pageId: string, error: any): void {
    NotionBackupLogger.error(pageId, error)
  }
}
