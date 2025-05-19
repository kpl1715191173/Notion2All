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

      const fileName = `${pageId}.json`
      const filePath = path.join(this.outputDir, fileName)

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

      // 创建父页面目录下的 sub_pages 目录
      const subPagesDir = path.join(this.outputDir, parentPageId, 'sub_pages')
      await mkdir(subPagesDir, { recursive: true })

      const fileName = `${subPageId}.json`
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
