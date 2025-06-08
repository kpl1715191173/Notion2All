import { Logger, LogLevel } from './base'

/**
 * Notion备份专用日志管理器
 *
 * 最佳实践:
 * 1. 使用configureLogging()函数统一设置日志级别
 * 2. 直接使用静态方法如NotionBackupLogger.log()记录日志
 * 3. 始终指定日志级别参数，确保日志输出行为一致
 * 4. 避免直接使用getInstance()方法，推荐使用getNotionInstance()
 */
export class NotionBackupLogger extends Logger {
  private static notionInstance: NotionBackupLogger

  private constructor() {
    super()
    // 确保NotionBackupLogger默认也使用level1级别的日志
    this.setLogLevel(LogLevel.level1)
  }

  /**
   * 获取NotionBackupLogger实例
   * 推荐使用此方法获取日志实例
   */
  static getNotionInstance(): NotionBackupLogger {
    if (!NotionBackupLogger.notionInstance) {
      NotionBackupLogger.notionInstance = new NotionBackupLogger()
    }
    return NotionBackupLogger.notionInstance
  }

  /**
   * 获取NotionBackupLogger实例
   * @deprecated 此方法已废弃，请使用getNotionInstance()方法
   */
  static getInstance(): NotionBackupLogger {
    return NotionBackupLogger.getNotionInstance()
  }

  processStart(pageId: string, parentIds: string[] = [], level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(
        `[开始处理] 页面 ${pageId}${
          parentIds.length > 0 ? ` (父页面: ${parentIds.join(' -> ')})` : ''
        }`,
        level
      )
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

  fetchBlockChildren(blockId: string, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[网络请求] 获取块 ${blockId} 的子块列表`, level)
    }
  }

  fetchBlockChildrenComplete(
    blockId: string,
    count: number,
    level: LogLevel = LogLevel.level1
  ): void {
    if (this.shouldLog(level)) {
      this.log(`[网络请求] 块 ${blockId} 获取到 ${count} 个子块`, level)
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

  serialComplete(
    pageId: string,
    count: number,
    time: string,
    level: LogLevel = LogLevel.level1
  ): void {
    if (this.shouldLog(level)) {
      this.log(`[串行子页面] 页面 ${pageId} 的 ${count} 个子页面处理完成，耗时: ${time} ms`, level)
    }
  }

  concurrentProcess(count: number, childCount: number, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.log(`[并发处理] 使用并发数 ${count} 处理 ${childCount} 个子页面`, level)
    }
  }

  concurrentComplete(
    pageId: string,
    count: number,
    time: string,
    level: LogLevel = LogLevel.level1
  ): void {
    if (this.shouldLog(level)) {
      this.log(`[并发子页面] 页面 ${pageId} 的 ${count} 个子页面处理完成，耗时: ${time} ms`, level)
    }
  }

  error(pageId: string, error: any, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.error(
        `[错误] 处理页面 ${pageId} 失败: ${error instanceof Error ? error.message : String(error)}`,
        level
      )
    }
  }

  warning(message: string, level: LogLevel = LogLevel.level1): void {
    if (this.shouldLog(level)) {
      this.warning(message, level)
    }
  }

  // 静态方法提供便捷的日志访问
  static processStart(
    pageId: string,
    parentIds: string[] = [],
    level: LogLevel = LogLevel.level1
  ): void {
    NotionBackupLogger.getNotionInstance().processStart(pageId, parentIds, level)
  }

  static useCache(pageId: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().useCache(pageId, level)
  }

  static fetchData(pageId: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().fetchData(pageId, level)
  }

  static fetchBlockChildren(blockId: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().fetchBlockChildren(blockId, level)
  }

  static fetchBlockChildrenComplete(
    blockId: string,
    count: number,
    level: LogLevel = LogLevel.level1
  ): void {
    NotionBackupLogger.getNotionInstance().fetchBlockChildrenComplete(blockId, count, level)
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

  static serialComplete(
    pageId: string,
    count: number,
    time: string,
    level: LogLevel = LogLevel.level1
  ): void {
    NotionBackupLogger.getNotionInstance().serialComplete(pageId, count, time, level)
  }

  static concurrentProcess(
    count: number,
    childCount: number,
    level: LogLevel = LogLevel.level1
  ): void {
    NotionBackupLogger.getNotionInstance().concurrentProcess(count, childCount, level)
  }

  static concurrentComplete(
    pageId: string,
    count: number,
    time: string,
    level: LogLevel = LogLevel.level1
  ): void {
    NotionBackupLogger.getNotionInstance().concurrentComplete(pageId, count, time, level)
  }

  static error(pageId: string, error: any, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().error(pageId, error, level)
  }

  static warning(message: string, level: LogLevel = LogLevel.level1): void {
    NotionBackupLogger.getNotionInstance().warning(message, level)
  }
}

/**
 * 配置全局日志系统
 * 使用此函数在应用程序启动时统一设置日志级别
 * @param level 日志级别
 */
export function configureLogging(level: LogLevel): void {
  // 设置NotionBackupLogger日志级别
  NotionBackupLogger.getNotionInstance().setLogLevel(level)
  // 同时设置基础Logger日志级别以保持一致性
  Logger.getInstance().setLogLevel(level)
}

// 导出Notion备份日志实例
export const notionBackupLogger = NotionBackupLogger.getNotionInstance()
