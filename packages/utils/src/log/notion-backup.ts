import { Logger, LogLevel, IndentLevel } from './base'

/**
 * Notion备份专用日志管理器
 *
 * 最佳实践:
 * 1. 使用configureLogging()函数统一设置日志级别
 * 2. 直接使用静态方法如NotionBackupLogger.log()记录日志
 * 3. 避免直接使用getInstance()方法，推荐使用getNotionInstance()
 */
export class NotionBackupLogger extends Logger {
  private static notionInstance: NotionBackupLogger

  private constructor() {
    super()
  }

  static getNotionInstance(): NotionBackupLogger {
    if (!NotionBackupLogger.notionInstance) {
      NotionBackupLogger.notionInstance = new NotionBackupLogger()
    }
    return NotionBackupLogger.notionInstance
  }

  // 重写 log 方法，自动获取全局缩进等级并支持微调
  log(message: string, adjust: number = 0): void {
    const baseIndent = Logger.getInstance().getLogLevel()
    const indentLevel = baseIndent + adjust
    super.log(message, indentLevel)
  }

  // 新增 cacheLog 方法，专用于缓存相关日志，自动获取全局缩进等级
  cacheLog(message: string, adjust: number = 0): void {
    const baseIndent = Logger.getInstance().getLogLevel()
    const indentLevel = baseIndent + adjust
    super.log(message, indentLevel)
  }

  // 业务相关日志方法，全部只传 message，内部自动缩进
  processStart(pageId: string, parentIds: string[] = []): void {
    this.log(
      `[开始处理] 页面 ${pageId}${parentIds.length > 0 ? ` (父页面: ${parentIds.join(' -> ')})` : ''}`
    )
  }
  useCache(pageId: string): void {
    this.log(`[使用缓存] 页面 ${pageId} 使用本地缓存`)
  }
  fetchData(pageId: string): void {
    this.log(`[网络请求] 页面 ${pageId} 需要更新，获取完整内容`)
  }
  fetchBlock(blockId: string): void {
    this.log(`[网络请求] 获取块 ${blockId} 的子块列表`)
  }
  fetchBlockChildren(blockId: string, count?: number): void {
    this.log(`[网络请求] 块 ${blockId} 获取到 ${count ?? 0} 个子块`)
  }
  saveData(pageId: string): void {
    this.log(`[保存文件] 保存页面 ${pageId} 的完整内容`)
  }
  downloadFiles(pageId: string, count: number): void {
    this.log(`[下载文件] 页面 ${pageId} 发现 ${count} 个文件`)
  }
  childPages(pageId: string, count: number): void {
    this.log(`[子页面处理] ${pageId} 有 ${count} 个子页面需要处理`)
  }
  serialComplete(pageId: string, count: number, time: string): void {
    this.log(`[串行子页面] 页面 ${pageId} 的 ${count} 个子页面处理完成，耗时: ${time} ms`)
  }
  concurrentProcess(count: number, childCount: number): void {
    this.log(`[并发处理] 使用并发数 ${count} 处理 ${childCount} 个子页面`)
  }
  concurrentComplete(pageId: string, count: number, time: string): void {
    this.log(`[并发子页面] 页面 ${pageId} 的 ${count} 个子页面处理完成，耗时: ${time} ms`)
  }
  error(pageId: string, error: any): void {
    const baseIndent = Logger.getInstance().getLogLevel()
    super.error(
      `[错误] 处理页面 ${pageId} 失败: ${error instanceof Error ? error.message : String(error)}`,
      baseIndent
    )
  }
  warning(message: string): void {
    const baseIndent = Logger.getInstance().getLogLevel()
    super.warning(message, baseIndent)
  }

  // 静态方法提供便捷的日志访问
  static processStart(pageId: string, parentIds: string[] = []): void {
    NotionBackupLogger.getNotionInstance().processStart(pageId, parentIds)
  }
  static useCache(pageId: string): void {
    NotionBackupLogger.getNotionInstance().useCache(pageId)
  }
  static fetchData(pageId: string): void {
    NotionBackupLogger.getNotionInstance().fetchData(pageId)
  }
  static fetchBlock(blockId: string): void {
    NotionBackupLogger.getNotionInstance().fetchBlock(blockId)
  }
  static fetchBlockChildren(blockId: string, count?: number): void {
    NotionBackupLogger.getNotionInstance().fetchBlockChildren(blockId, count)
  }
  static saveData(pageId: string): void {
    NotionBackupLogger.getNotionInstance().saveData(pageId)
  }
  static downloadFiles(pageId: string, count: number): void {
    NotionBackupLogger.getNotionInstance().downloadFiles(pageId, count)
  }
  static childPages(pageId: string, count: number): void {
    NotionBackupLogger.getNotionInstance().childPages(pageId, count)
  }
  static serialComplete(pageId: string, count: number, time: string): void {
    NotionBackupLogger.getNotionInstance().serialComplete(pageId, count, time)
  }
  static concurrentProcess(count: number, childCount: number): void {
    NotionBackupLogger.getNotionInstance().concurrentProcess(count, childCount)
  }
  static concurrentComplete(pageId: string, count: number, time: string): void {
    NotionBackupLogger.getNotionInstance().concurrentComplete(pageId, count, time)
  }
  static error(pageId: string, error: any): void {
    NotionBackupLogger.getNotionInstance().error(pageId, error)
  }
  static warning(message: string): void {
    NotionBackupLogger.getNotionInstance().warning(message)
  }
  static cacheLog(message: string, adjust: number = 0): void {
    NotionBackupLogger.getNotionInstance().cacheLog(message, adjust)
  }
}

/**
 * 配置全局日志系统
 * 使用此函数在应用程序启动时统一设置日志级别和缩进间隔
 * @param level 日志级别
 * @param indentSpacing 缩进间隔
 */
export function configureLogging(level: LogLevel, indentSpacing?: number): void {
  NotionBackupLogger.getNotionInstance().configureLogging(level, indentSpacing)
  Logger.getInstance().configureLogging(level, indentSpacing)
}

// 导出Notion备份日志实例
export const notionBackupLogger = NotionBackupLogger.getNotionInstance()
