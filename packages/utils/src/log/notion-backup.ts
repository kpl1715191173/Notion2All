import { Logger, LogLevel } from './base'

/**
 * Notion备份专用日志管理器
 */
export class NotionBackupLogger extends Logger {
  private static notionInstance: NotionBackupLogger

  private constructor() {
    super()
    // 确保NotionBackupLogger默认也使用level1级别的日志
    this.setLogLevel(LogLevel.level1)
  }

  static getNotionInstance(): NotionBackupLogger {
    if (!NotionBackupLogger.notionInstance) {
      NotionBackupLogger.notionInstance = new NotionBackupLogger()
    }
    return NotionBackupLogger.notionInstance
  }

  processStart(pageId: string, parentIds: string[] = [], level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[开始处理] 页面 ${pageId}${
        parentIds.length > 0 ? ` (父页面: ${parentIds.join(' -> ')})` : ''
      }`, level)
    }
  }
  
  useCache(pageId: string, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[使用缓存] 页面 ${pageId} 使用本地缓存`, level)
    }
  }
  
  fetchData(pageId: string, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[网络请求] 页面 ${pageId} 需要更新，获取完整内容`, level)
    }
  }
  
  saveData(pageId: string, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[保存文件] 保存页面 ${pageId} 的完整内容`, level)
    }
  }
  
  downloadFiles(pageId: string, count: number, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[下载文件] 页面 ${pageId} 发现 ${count} 个文件`, level)
    }
  }
  
  childPages(pageId: string, count: number, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[子页面处理] ${pageId} 有 ${count} 个子页面需要处理`, level)
    }
  }
  
  serialComplete(pageId: string, count: number, time: string, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[串行子页面] 页面 ${pageId} 的 ${count} 个子页面处理完成，耗时: ${time} ms`, level)
    }
  }
  
  concurrentProcess(count: number, childCount: number, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[并发处理] 使用并发数 ${count} 处理 ${childCount} 个子页面`, level)
    }
  }
  
  concurrentComplete(pageId: string, count: number, time: string, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[并发子页面] 页面 ${pageId} 的 ${count} 个子页面处理完成，耗时: ${time} ms`, level)
    }
  }
  
  error(pageId: string, error: any, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.error(`[错误] 处理页面 ${pageId} 失败: ${error instanceof Error ? error.message : String(error)}`, level)
    }
  }

  // 静态方法提供便捷的日志访问
  static processStart(pageId: string, parentIds: string[] = [], level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().processStart(pageId, parentIds, level)
  }

  static useCache(pageId: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().useCache(pageId, level)
  }

  static fetchData(pageId: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().fetchData(pageId, level)
  }

  static saveData(pageId: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().saveData(pageId, level)
  }

  static downloadFiles(pageId: string, count: number, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().downloadFiles(pageId, count, level)
  }

  static childPages(pageId: string, count: number, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().childPages(pageId, count, level)
  }

  static serialComplete(pageId: string, count: number, time: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().serialComplete(pageId, count, time, level)
  }

  static concurrentProcess(count: number, childCount: number, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().concurrentProcess(count, childCount, level)
  }

  static concurrentComplete(pageId: string, count: number, time: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().concurrentComplete(pageId, count, time, level)
  }

  static error(pageId: string, error: any, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().error(pageId, error, level)
  }
}

// 导出Notion备份日志实例
export const notionBackupLogger = NotionBackupLogger.getNotionInstance() 