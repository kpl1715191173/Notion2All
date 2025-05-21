import { writeFile, mkdir, readFile } from 'fs/promises'
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
  private readonly logRecursive: boolean

  /**
   * 创建 NotionPageSaver 实例
   * @param opt
   */
  constructor(opt: { outputDir: string; logRecursive?: boolean }) {
    this.outputDir = opt.outputDir
    this.logRecursive = opt.logRecursive || false
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
    // E.g. 1664f1d48d2b80f9929ad415aa88b822 -> 1664f1d4-8d2b-80f9-929a-d415aa88b822
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
   * 检查页面是否需要更新
   * @param pageId 页面ID
   * @param lastEditedTime 页面的最后编辑时间
   * @param parentPageIds 父页面ID链
   * @returns 是否需要更新
   */
  private async shouldUpdatePage(
    pageId: string,
    lastEditedTime: string,
    parentPageIds: string[] = []
  ): Promise<boolean> {
    try {
      const formattedIds = parentPageIds.map(id => this.formatPageId(id))
      const formattedPageId = this.formatPageId(pageId)
      const pageDir = path.join(this.outputDir, ...formattedIds, formattedPageId)
      const filePath = path.join(pageDir, `${formattedPageId}.json`)

      // 检查文件是否存在
      try {
        const fileContent = await readFile(filePath, 'utf-8')
        const localData = JSON.parse(fileContent)

        // 比较最后编辑时间
        const needsUpdate = localData.last_edited_time !== lastEditedTime
        console.log(
          `[缓存检查] 页面 ${pageId}:\n` +
            `  本地时间: ${localData.last_edited_time}\n` +
            `  远程时间: ${lastEditedTime}\n` +
            `  需要更新: ${needsUpdate ? '是' : '否'}`
        )
        return needsUpdate
      } catch (error) {
        console.log(`[缓存检查] 页面 ${pageId} 本地文件不存在，需要更新`)
        return true
      }
    } catch (error) {
      console.log(`[缓存检查] 页面 ${pageId} 检查过程出错，需要更新`)
      return true
    }
  }

  /**
   * 处理子页面
   * @param children 子页面列表
   * @param pageId 当前页面ID
   * @param notionApi NotionApi 实例
   * @param parentPageIds 父页面ID链
   * @returns 所有保存结果数组
   */
  private async processChildPages(
    children: any[],
    pageId: string,
    notionApi: any,
    parentPageIds: string[]
  ): Promise<SaveResult[]> {
    const results: SaveResult[] = []
    for (const block of children) {
      if (block.type === 'child_page' && block.id) {
        if (this.logRecursive)
          console.log('[发现子页面]', block.id, '父链:', [...parentPageIds, pageId])
        const childResults = await this.savePageRecursively(block.id, notionApi, [
          ...parentPageIds,
          pageId,
        ])
        results.push(...childResults)
      }
    }
    return results
  }

  /**
   * 递归保存页面及其所有子页面，支持多层级嵌套
   * @param pageId 页面ID
   * @param notionApi NotionApi 实例
   * @param parentPageIds 父页面ID链（从根到父），默认[]
   * @returns 所有保存结果数组
   */
  async savePageRecursively(
    pageId: string,
    notionApi: any,
    parentPageIds: string[] = []
  ): Promise<SaveResult[]> {
    const results: SaveResult[] = []
    try {
      console.log(
        `\n[开始处理] 页面 ${pageId}${parentPageIds.length > 0 ? ` (父页面: ${parentPageIds.join(' -> ')})` : ''}`
      )

      // 1. 获取页面基本信息
      console.log(`[网络请求] 获取页面 ${pageId} 的基本信息`)
      const pageData = await notionApi.getPage(pageId)

      // 2. 检查是否需要更新
      const needsUpdate = await this.shouldUpdatePage(
        pageId,
        pageData.last_edited_time,
        parentPageIds
      )

      if (!needsUpdate) {
        console.log(`[使用缓存] 页面 ${pageId} 使用本地缓存`)
        // 如果不需要更新，直接返回成功结果
        const formattedIds = parentPageIds.map(id => this.formatPageId(id))
        const formattedPageId = this.formatPageId(pageId)
        const filePath = path.join(
          this.outputDir,
          ...formattedIds,
          formattedPageId,
          `${formattedPageId}.json`
        )

        results.push({
          success: true,
          filePath,
        })

        // 继续处理子页面
        console.log(`[网络请求] 获取页面 ${pageId} 的子页面列表`)
        const children = await notionApi.getBlockChildren(pageId)
        const childResults = await this.processChildPages(
          children,
          pageId,
          notionApi,
          parentPageIds
        )
        results.push(...childResults)
        return results
      }

      // 3. 如果需要更新，获取完整数据
      console.log(`[网络请求] 页面 ${pageId} 需要更新，获取完整内容`)
      const children = await notionApi.getBlockChildren(pageId)
      const fullData = { ...pageData, children }

      // 4. 保存当前页面
      console.log(`[保存文件] 保存页面 ${pageId} 的完整内容`)
      const saveResult = await this.savePageData(
        pageId,
        fullData,
        parentPageIds.length > 0 ? parentPageIds[parentPageIds.length - 1] : undefined,
        parentPageIds
      )
      results.push(saveResult)
      if (!saveResult.success) return results

      // 5. 处理子页面
      const childResults = await this.processChildPages(children, pageId, notionApi, parentPageIds)
      results.push(...childResults)
    } catch (error) {
      console.log(
        `[错误] 处理页面 ${pageId} 时发生错误:`,
        error instanceof Error ? error.message : String(error)
      )
      results.push({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
    return results
  }

  /**
   * 保存页面数据到文件
   * @param pageId 页面ID
   * @param data 页面数据
   * @param parentPageId 父页面ID（可选）
   * @param parentPageIds 父页面ID链（从根到父），默认[]
   * @returns 保存结果
   */
  async savePageData(
    pageId: string,
    data: PageObject,
    parentPageId?: string,
    parentPageIds: string[] = []
  ): Promise<SaveResult> {
    try {
      await this.ensureOutputDir()
      const formattedIds = parentPageIds.map(id => this.formatPageId(id))
      const formattedPageId = this.formatPageId(pageId)
      const pageDir = path.join(this.outputDir, ...formattedIds, formattedPageId)
      // 调试输出
      if (this.logRecursive)
        console.log(
          '[savePageData] 保存页面:',
          pageId,
          '父链:',
          parentPageIds,
          '保存目录:',
          pageDir
        )
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
}
