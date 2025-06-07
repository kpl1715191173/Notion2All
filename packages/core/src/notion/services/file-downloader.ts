import { mkdir } from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import https from 'https'
import { SaveResult } from '../types'
import { formatId } from '../utils'
import { Logger, LogLevel } from '@notion2all/utils'

interface DownloadProgress {
  downloaded: number
  total: number
  percentage: number
}

interface DownloadOptions {
  chunkSize?: number
  onProgress?: (progress: DownloadProgress) => void
  retryCount?: number
  logLevel?: LogLevel
  progressInterval?: number // 进度更新间隔（毫秒）
  progressThreshold?: number // 进度更新阈值（百分比）
}

/**
 * Notion 文件下载器
 * 负责下载和保存Notion页面中的各种文件（图片、PDF、视频等）
 */
export class NotionFileDownloader {
  private readonly DEFAULT_CHUNK_SIZE = 1024 * 1024 // 1MB
  private readonly DEFAULT_RETRY_COUNT = 3
  private readonly DEFAULT_PROGRESS_INTERVAL = 2000 // 2秒
  private readonly DEFAULT_PROGRESS_THRESHOLD = 5 // 5%

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
      retryCount = this.DEFAULT_RETRY_COUNT,
      logLevel = LogLevel.level2,
      progressInterval = this.DEFAULT_PROGRESS_INTERVAL,
      progressThreshold = this.DEFAULT_PROGRESS_THRESHOLD
    } = options

    const totalSize = await this.getFileSize(url)
    let downloadedSize = 0
    let currentRetry = 0
    let lastProgressUpdate = 0
    let lastProgressPercentage = 0

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
              const currentPercentage = Math.round((downloadedSize / totalSize) * 100)
              const now = Date.now()

              // 检查是否需要更新进度
              const shouldUpdate = 
                now - lastProgressUpdate >= progressInterval && // 时间间隔
                Math.abs(currentPercentage - lastProgressPercentage) >= progressThreshold // 进度变化

              if (shouldUpdate || currentPercentage === 100) {
                if (onProgress) {
                  onProgress({
                    downloaded: downloadedSize,
                    total: totalSize,
                    percentage: currentPercentage
                  })
                }
                lastProgressUpdate = now
                lastProgressPercentage = currentPercentage
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
        Logger.warning(`[下载] 下载出错，正在进行第${currentRetry}次重试...`, logLevel)
        await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry)) // 重试延迟
      }
    }

    writeStream.end()
  }

  /**
   * 保存文件
   * @param config.pageId 页面ID
   * @param config.blockId 文件块ID
   * @param config.fileUrl 文件URL
   * @param config.options 下载选项
   * @returns 保存结果
   */
  async saveFile(
    config: {
      pageId: string;
      blockId: string;
      fileUrl: string;
      options?: DownloadOptions;
    }
  ): Promise<SaveResult> {
    const { pageId, blockId, fileUrl, options = {} } = config;
    const logLevel = options.logLevel ?? LogLevel.level2

    try {
      // 生成文件名
      const fileName = this.generateFileName(blockId, fileUrl)
      
      // 创建文件目录
      const formattedPageId = formatId(pageId)
      const fileDir = path.join(this.outputDir, formattedPageId, 'assets')
      await this.ensureDir(fileDir)
      
      // 文件保存路径
      const filePath = path.join(fileDir, fileName)
      
      // 下载文件
      Logger.log(`[下载] 开始下载文件 ${blockId} 到 ${filePath}`, logLevel)
      await this.downloadFileWithChunks(fileUrl, filePath, {
        ...options,
        onProgress: (progress) => {
          if (options.onProgress) {
            options.onProgress(progress)
          }
          if (progress.percentage % 20 === 0 || progress.percentage === 100) {
            Logger.log(
              `[下载] 文件 ${blockId} 下载进度: ${progress.percentage}% (${Math.round(progress.downloaded / 1024)}KB/${Math.round(progress.total / 1024)}KB)`,
              logLevel
            )
          }
        }
      })
      
      Logger.log(`[下载] 文件 ${blockId} 下载完成`, logLevel)
      return {
        success: true,
        filePath
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      Logger.error(`[下载] 文件 ${blockId} 下载失败: ${errorMessage}`, logLevel)
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * 批量保存文件
   * @param config.pageId 页面ID
   * @param config.files 文件信息数组
   * @param config.options 下载选项
   * @returns 保存结果数组
   */
  async saveFiles(
    config: {
      pageId: string;
      files: Array<{ blockId: string; url: string }>;
      options?: DownloadOptions;
    }
  ): Promise<SaveResult[]> {
    const { pageId, files, options = {} } = config;
    const results: SaveResult[] = []
    const logLevel = options.logLevel ?? LogLevel.level2
    
    Logger.log(`[下载] 开始下载 ${files.length} 个文件`, logLevel)
    
    for (const file of files) {
      const result = await this.saveFile({
        pageId,
        blockId: file.blockId,
        fileUrl: file.url,
        options
      })
      results.push(result)
    }
    
    const successCount = results.filter(r => r.success).length
    Logger.log(`[下载] 文件下载完成，成功: ${successCount}/${files.length}`, logLevel)
    
    return results
  }
} 