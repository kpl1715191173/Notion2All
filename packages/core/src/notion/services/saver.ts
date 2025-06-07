import { Logger, LogLevel } from '@notion2all/utils'
import { promises as fs } from 'fs'
import path from 'path'
import { PageObject, SaveResult } from '../types'
import { formatId } from '../utils'

/**
 * Notion 页面数据保存器
 * 负责将页面数据保存到本地文件系统
 */
export class NotionPageSaver {
  constructor(private outputDir: string) {}

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
  async savePageData(
    config: {
      pageId: string;
      data: PageObject;
      parentPageIds?: string[];
    }
  ): Promise<SaveResult> {
    const { pageId, data, parentPageIds = [] } = config;
    try {
      const formattedIds = parentPageIds.map(id => formatId(id))
      const formattedPageId = formatId(pageId)
      const pageDir = path.join(this.outputDir, ...formattedIds, formattedPageId)
      const filePath = path.join(pageDir, `${formattedPageId}.json`)

      await this.ensureDirectoryExists(path.dirname(filePath))
      
      Logger.log(`[保存] 保存页面 ${pageId} 到 ${filePath}`, LogLevel.level2)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

      return {
        success: true,
        filePath,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logger.error(`[保存] 保存页面 ${pageId} 失败: ${errorMessage}`, LogLevel.level2)
      return {
        success: false,
        error: errorMessage,
      }
    }
  }

  private getSavePath(config: { pageId: string; parentIds?: string[] }): string {
    const { pageId, parentIds = [] } = config;
    const relativePath = parentIds.length > 0
      ? path.join(...parentIds, pageId)
      : pageId
    return path.join(this.outputDir, `${relativePath}.json`)
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath)
    } catch {
      Logger.log(`[保存] 创建目录 ${dirPath}`, LogLevel.level2)
      await fs.mkdir(dirPath, { recursive: true })
    }
  }
} 