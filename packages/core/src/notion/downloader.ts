import { mkdir, writeFile } from 'fs/promises'
import path from 'path'
import https from 'https'
import { SaveResult } from './types'
import { formatId } from './utils'

/**
 * Notion 文件下载器
 * 负责下载和保存Notion页面中的各种文件（图片、PDF、视频等）
 */
export class NotionFileDownloader {
  constructor(private outputDir: string) {}

  /**
   * 生成文件名
   * @param blockId 文件块ID
   * @param url 文件URL
   * @returns 生成的文件名
   */
  private generateFileName(blockId: string, url: string): string {
    // 格式化blockId，确保使用连字符格式
    const formattedBlockId = formatId(blockId)
    
    // 从URL中提取文件扩展名
    const urlObj = new URL(url)
    const pathname = urlObj.pathname
    const originalName = path.basename(pathname)
    const ext = path.extname(originalName) || '.png'
    
    // 使用blockId作为文件名
    return `${formattedBlockId}${ext}`
  }

  /**
   * 确保输出目录存在
   * @param dirPath 目录路径
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await mkdir(dirPath, { recursive: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw new Error(`创建目录失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * 下载文件
   * @param url 文件URL
   * @returns Promise<Buffer>
   */
  private downloadFile(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败，状态码: ${response.statusCode}`))
          return
        }

        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => resolve(Buffer.concat(chunks)))
        response.on('error', reject)
      }).on('error', reject)
    })
  }

  /**
   * 保存文件
   * @param pageId 页面ID
   * @param blockId 文件块ID
   * @param fileUrl 文件URL
   * @returns 保存结果
   */
  async saveFile(pageId: string, blockId: string, fileUrl: string): Promise<SaveResult> {
    try {
      // 1. 创建assets目录
      const formattedPageId = formatId(pageId)
      const assetsDir = path.join(this.outputDir, formattedPageId, 'assets')
      await this.ensureDir(assetsDir)

      // 2. 生成文件名
      const fileName = this.generateFileName(blockId, fileUrl)
      const filePath = path.join(assetsDir, fileName)

      // 3. 下载文件
      console.log(`[下载文件] 开始下载: ${fileUrl}`)
      const fileData = await this.downloadFile(fileUrl)

      // 4. 保存文件
      await writeFile(filePath, fileData)
      console.log(`[下载文件] 保存成功: ${filePath}`)

      return {
        success: true,
        filePath
      }
    } catch (error) {
      console.error(`[下载文件] 失败: ${error instanceof Error ? error.message : String(error)}`)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * 批量下载文件
   * @param pageId 页面ID
   * @param files 文件信息数组
   * @returns 保存结果数组
   */
  async saveFiles(
    pageId: string, 
    files: Array<{ blockId: string; url: string }>
  ): Promise<SaveResult[]> {
    const results: SaveResult[] = []
    
    for (const file of files) {
      const result = await this.saveFile(pageId, file.blockId, file.url)
      results.push(result)
    }

    return results
  }
} 