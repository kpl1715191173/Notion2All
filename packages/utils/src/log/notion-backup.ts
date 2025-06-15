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
  private baseIndentLevel: IndentLevel = IndentLevel.L0

  private constructor() {
    super()
  }

  static getNotionInstance(): NotionBackupLogger {
    if (!NotionBackupLogger.notionInstance) {
      NotionBackupLogger.notionInstance = new NotionBackupLogger()
    }
    return NotionBackupLogger.notionInstance
  }

  // 设置基础缩进等级
  setBaseIndentLevel(level: IndentLevel): void {
    this.baseIndentLevel = level
  }

  getBaseIndentLevel(): IndentLevel {
    return this.baseIndentLevel
  }

  // 重写 log 方法，使用baseIndentLevel作为基准
  log(message: string, adjust: number = 0): void {
    const indentLevel = this.baseIndentLevel + adjust
    super.log(message, indentLevel)
  }

  // 新增 cacheLog 方法，使用baseIndentLevel作为基准
  cacheLog(message: string, adjust: number = 0): void {
    const indentLevel = this.baseIndentLevel + adjust
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
    const indentLevel = this.baseIndentLevel
    super.error(
      `[错误] 处理页面 ${pageId} 失败: ${error instanceof Error ? error.message : String(error)}`,
      indentLevel
    )
  }
  warning(message: string): void {
    const indentLevel = this.baseIndentLevel
    super.warning(message, indentLevel)
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
 * 使用此函数在应用程序启动时统一设置日志级别和缩进相关配置
 * @param config 日志配置对象
 * @param config.level 日志级别 - 控制显示哪些级别的日志（必需）
 * @param config.baseIndentLevel 基础缩进等级 - 设置日志缩进的基准级别（必需）
 * @param config.indentSpacing 缩进间隔 - 每级缩进的空格数量（可选）
 */
export function configureLogging(config: {
  level: LogLevel;
  baseIndentLevel: IndentLevel;
  indentSpacing?: number;
}): void {
  // 设置日志级别和缩进间隔
  NotionBackupLogger.getNotionInstance().configureLogging(config.level, config.indentSpacing)
  Logger.getInstance().configureLogging(config.level, config.indentSpacing)
  
  // 设置基础缩进等级
  NotionBackupLogger.getNotionInstance().setBaseIndentLevel(config.baseIndentLevel)
}

// 导出Notion备份日志实例
export const notionBackupLogger = NotionBackupLogger.getNotionInstance()
