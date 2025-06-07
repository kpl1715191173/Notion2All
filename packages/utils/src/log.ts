export enum LogLevel {
  level0 = 0,
  level1 = 1,
  level2 = 2,
  level3 = 3,
  level4 = 4,
}

type LogFunction = (message: string) => void

const spacing = 4

const createLogHandler = (
  message: string,
  logFn: LogFunction,
  icon: string = '',
  level: LogLevel = LogLevel.level0
): void => {
  const indent = ' '.repeat(level * spacing)
  const lines = message.split('\n')
  lines.forEach((line: string, index: number) => {
    const prefix = index === 0 ? icon : ' '.repeat(icon.length)
    logFn(`${indent}${prefix}${line}`)
  })
}

// 为了保持向后兼容，保留原有的导出
export const log = (message: string, level: LogLevel = LogLevel.level0): void => {
  createLogHandler(message, console.log, '', level)
}

export const errorLog = (message: string, level: LogLevel = LogLevel.level0): void => {
  createLogHandler(message, console.error, '❌  ', level)
}

export const successLog = (message: string, level: LogLevel = LogLevel.level0): void => {
  createLogHandler(message, console.log, '✅  ', level)
}

export const warningLog = (message: string, level: LogLevel = LogLevel.level0): void => {
  createLogHandler(message, console.warn, '⚠️  ', level)
}

// 添加一些专用的日志函数，用于特定场景
export const notionLog = {
  processStart: (pageId: string, parentIds: string[] = [], level: LogLevel = LogLevel.level1): void => {
    log(`[开始处理] 页面 ${pageId}${
      parentIds.length > 0 ? ` (父页面: ${parentIds.join(' -> ')})` : ''
    }`, level)
  },
  
  useCache: (pageId: string, level: LogLevel = LogLevel.level1): void => {
    log(`[使用缓存] 页面 ${pageId} 使用本地缓存`, level)
  },
  
  fetchData: (pageId: string, level: LogLevel = LogLevel.level1): void => {
    log(`[网络请求] 页面 ${pageId} 需要更新，获取完整内容`, level)
  },
  
  saveData: (pageId: string, level: LogLevel = LogLevel.level1): void => {
    log(`[保存文件] 保存页面 ${pageId} 的完整内容`, level)
  },
  
  downloadFiles: (pageId: string, count: number, level: LogLevel = LogLevel.level1): void => {
    log(`[下载文件] 页面 ${pageId} 发现 ${count} 个文件`, level)
  },
  
  childPages: (pageId: string, count: number, level: LogLevel = LogLevel.level1): void => {
    log(`[子页面处理] ${pageId} 有 ${count} 个子页面需要处理`, level)
  },
  
  serialComplete: (pageId: string, count: number, time: string, level: LogLevel = LogLevel.level1): void => {
    log(`[串行子页面] 页面 ${pageId} 的 ${count} 个子页面处理完成，耗时: ${time} ms`, level)
  },
  
  concurrentProcess: (count: number, childCount: number, level: LogLevel = LogLevel.level1): void => {
    log(`[并发处理] 使用并发数 ${count} 处理 ${childCount} 个子页面`, level)
  },
  
  concurrentComplete: (pageId: string, count: number, time: string, level: LogLevel = LogLevel.level1): void => {
    log(`[并发子页面] 页面 ${pageId} 的 ${count} 个子页面处理完成，耗时: ${time} ms`, level)
  },
  
  error: (pageId: string, error: any, level: LogLevel = LogLevel.level1): void => {
    errorLog(`[错误] 处理页面 ${pageId} 失败: ${error instanceof Error ? error.message : String(error)}`, level)
  }
}

/**
 * 基础日志管理器
 */
export class Logger {
  private static instance: Logger
  protected currentLogLevel: LogLevel = LogLevel.level1

  protected constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  setLogLevel(level: LogLevel) {
    this.currentLogLevel = level
  }

  getLogLevel(): LogLevel {
    return this.currentLogLevel
  }

  shouldLog(level: LogLevel): boolean {
    return level <= this.currentLogLevel
  }

  log(message: string, level: LogLevel = LogLevel.level0): void {
    if (this.shouldLog(level)) {
      createLogHandler(message, console.log, '', level)
    }
  }

  error(message: string, level: LogLevel = LogLevel.level0): void {
    if (this.shouldLog(level)) {
      createLogHandler(message, console.error, '❌  ', level)
    }
  }

  success(message: string, level: LogLevel = LogLevel.level0): void {
    if (this.shouldLog(level)) {
      createLogHandler(message, console.log, '✅  ', level)
    }
  }

  warning(message: string, level: LogLevel = LogLevel.level0): void {
    if (this.shouldLog(level)) {
      createLogHandler(message, console.warn, '⚠️  ', level)
    }
  }

  // 静态方法提供便捷的日志访问
  static log(message: string, level: LogLevel = LogLevel.level0): void {
    Logger.getInstance().log(message, level)
  }

  static error(message: string, level: LogLevel = LogLevel.level0): void {
    Logger.getInstance().error(message, level)
  }

  static success(message: string, level: LogLevel = LogLevel.level0): void {
    Logger.getInstance().success(message, level)
  }

  static warning(message: string, level: LogLevel = LogLevel.level0): void {
    Logger.getInstance().warning(message, level)
  }
}

/**
 * Notion专用日志管理器
 */
export class NotionLogger extends Logger {
  private static notionInstance: NotionLogger

  private constructor() {
    super()
    // 确保NotionLogger默认也使用level1级别的日志
    this.setLogLevel(LogLevel.level1)
  }

  static getNotionInstance(): NotionLogger {
    if (!NotionLogger.notionInstance) {
      NotionLogger.notionInstance = new NotionLogger()
    }
    return NotionLogger.notionInstance
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
    NotionLogger.getNotionInstance().processStart(pageId, parentIds, level)
  }

  static useCache(pageId: string, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().useCache(pageId, level)
  }

  static fetchData(pageId: string, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().fetchData(pageId, level)
  }

  static saveData(pageId: string, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().saveData(pageId, level)
  }

  static downloadFiles(pageId: string, count: number, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().downloadFiles(pageId, count, level)
  }

  static childPages(pageId: string, count: number, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().childPages(pageId, count, level)
  }

  static serialComplete(pageId: string, count: number, time: string, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().serialComplete(pageId, count, time, level)
  }

  static concurrentProcess(count: number, childCount: number, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().concurrentProcess(count, childCount, level)
  }

  static concurrentComplete(pageId: string, count: number, time: string, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().concurrentComplete(pageId, count, time, level)
  }

  static error(pageId: string, error: any, level: LogLevel = LogLevel.level1): void {
    NotionLogger.getNotionInstance().error(pageId, error, level)
  }
}

// 导出基础单例实例
export const logger = Logger.getInstance()
// 导出Notion日志实例
export const notionLogger = NotionLogger.getNotionInstance() 