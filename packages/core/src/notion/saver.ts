import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { NotionBlock } from './page'

/**
 * Notion 页面数据的保存结果接口
 */
export interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}

/**
 * Notion 页面数据对象接口
 */
export interface PageObject {
  id: string
  properties: Record<string, any>
  children: NotionBlock[]
  [key: string]: any
}

/**
 * Notion 页面数据保存器
 * 用于将 Notion 页面数据保存到本地文件系统
 */
export class NotionPageSaver {
  private readonly outputDir: string

  /**
   * 创建 NotionPageSaver 实例
   * @param outputDir 输出目录路径
   */
  constructor(outputDir: string) {
    this.outputDir = outputDir
  }

  /**
   * 格式化页面 ID，确保使用带连字符的格式
   * @param pageId 页面ID
   * @returns 格式化后的页面ID
   */
  private formatPageId(pageId: string): string {
    // 如果已经是带连字符的格式，直接返回
    if (pageId.includes('-')) {
      return pageId
    }
    
    // 将不带连字符的 ID 转换为带连字符的格式
    // 例如：1664f1d48d2b80f9929ad415aa88b822 -> 1664f1d4-8d2b-80f9-929a-d415aa88b822
    return pageId.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
  }

  /**
   * 确保输出目录存在
   * @throws 如果创建目录失败且错误不是目录已存在
   */
  private async ensureOutputDir(): Promise<void> {
    try {
      await mkdir(this.outputDir, { recursive: true })
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
   * @returns 保存结果
   */
  async savePageData(pageId: string, data: PageObject): Promise<SaveResult> {
    try {
      await this.ensureOutputDir()

      const formattedPageId = this.formatPageId(pageId)
      const pageDir = path.join(this.outputDir, formattedPageId)
      await mkdir(pageDir, { recursive: true })

      const fileName = `${formattedPageId}.json`
      const filePath = path.join(pageDir, fileName)

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

  /**
   * 保存子页面数据到文件
   * @param parentPageId 父页面ID
   * @param subPageId 子页面ID
   * @param data 子页面数据
   * @returns 保存结果
   */
  async saveSubPage(
    parentPageId: string,
    subPageId: string,
    data: PageObject
  ): Promise<SaveResult> {
    try {
      await this.ensureOutputDir()

      const formattedParentPageId = this.formatPageId(parentPageId)
      const formattedSubPageId = this.formatPageId(subPageId)
      
      const subPagesDir = path.join(this.outputDir, formattedParentPageId, 'sub_pages')
      await mkdir(subPagesDir, { recursive: true })

      const fileName = `${formattedSubPageId}.json`
      const filePath = path.join(subPagesDir, fileName)

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
