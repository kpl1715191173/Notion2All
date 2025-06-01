import { mkdir } from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import https from 'https'
import { SaveResult } from './types'
import { formatId } from './utils'

interface DownloadProgress {
  downloaded: number
  total: number
  percentage: number
}

interface DownloadOptions {
  chunkSize?: number
  onProgress?: (progress: DownloadProgress) => void
  retryCount?: number
}

/**
 * Notion 文件下载器
 * 负责下载和保存Notion页面中的各种文件（图片、PDF、视频等）
 */
export class NotionFileDownloader {
  private readonly DEFAULT_CHUNK_SIZE = 1024 * 1024 // 1MB
  private readonly DEFAULT_RETRY_COUNT = 3

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
   * 获取文件大小
   * @param url 文件URL
   * @returns Promise<number> 文件大小（字节）
   */
  private async getFileSize(url: string): Promise<number> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`获取文件大小失败，状态码: ${response.statusCode}`))
          return
        }
        const contentLength = response.headers['content-length']
        if (!contentLength) {
          reject(new Error('无法获取文件大小'))
          return
        }
        response.destroy()
        resolve(parseInt(contentLength, 10))
      }).on('error', reject)
    })
  }

  /**
   * 分段下载文件
   * @param url 文件URL
   * @param filePath 保存路径
   * @param options 下载选项
   * @returns Promise<void>
   */
  private async downloadFileWithChunks(
    url: string,
    filePath: string,
    options: DownloadOptions = {}
  ): Promise<void> {
    const {
      chunkSize = this.DEFAULT_CHUNK_SIZE,
      onProgress,
      retryCount = this.DEFAULT_RETRY_COUNT
    } = options

    const totalSize = await this.getFileSize(url)
    let downloadedSize = 0
    let currentRetry = 0

    const writeStream = createWriteStream(filePath)

    while (downloadedSize < totalSize && currentRetry < retryCount) {
      try {
        const start = downloadedSize
        const end = Math.min(start + chunkSize - 1, totalSize - 1)

        await new Promise<void>((resolve, reject) => {
          const request = https.get(url, {
            headers: {
              Range: `bytes=${start}-${end}`
            }
          }, (response) => {
            if (response.statusCode !== 206 && response.statusCode !== 200) {
              reject(new Error(`下载失败，状态码: ${response.statusCode}`))
              return
            }

            response.pipe(writeStream, { end: false })

            response.on('data', (chunk) => {
              downloadedSize += chunk.length
              if (onProgress) {
                onProgress({
                  downloaded: downloadedSize,
                  total: totalSize,
                  percentage: Math.round((downloadedSize / totalSize) * 100)
                })
              }
            })

            response.on('end', resolve)
            response.on('error', reject)
          })

          request.on('error', reject)
        })

        currentRetry = 0 // 重置重试计数
      } catch (error) {
        currentRetry++
        if (currentRetry >= retryCount) {
          throw new Error(`下载失败，已重试${retryCount}次: ${error instanceof Error ? error.message : String(error)}`)
        }
        console.warn(`下载出错，正在进行第${currentRetry}次重试...`)
        await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry)) // 重试延迟
      }
    }

    writeStream.end()
  }

  /**
   * 保存文件
   * @param pageId 页面ID
   * @param blockId 文件块ID
   * @param fileUrl 文件URL
   * @param options 下载选项
   * @returns 保存结果
   */
  async saveFile(
    pageId: string,
    blockId: string,
    fileUrl: string,
    options: DownloadOptions = {}
  ): Promise<SaveResult> {
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
      await this.downloadFileWithChunks(fileUrl, filePath, {
        ...options,
        onProgress: (progress) => {
          console.log(`[下载文件] 进度: ${progress.percentage}% (${progress.downloaded}/${progress.total} bytes)`)
          options.onProgress?.(progress)
        }
      })

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
