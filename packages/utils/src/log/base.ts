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

// 导出基础单例实例
export const logger = Logger.getInstance() 