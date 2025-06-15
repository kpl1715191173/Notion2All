export enum LogLevel {
  error = 0,
  warning = 1,
  success = 2,
  info = 3,
  debug = 4,
}

// 日志缩进等级枚举
export enum IndentLevel {
  L0 = 0,
  L1 = 1,
  L2 = 2,
  L3 = 3,
  L4 = 4,
}

const MAX_INDENT_LEVEL = 4
const MIN_INDENT_LEVEL = 0

function normalizeIndentLevel(level: IndentLevel | number): number {
  if (typeof level === 'string') {
    const match = /^L([0-4])$/.exec(level)
    if (match) return parseInt(match[1], 10)
    return 0
  }
  if (typeof level !== 'number' || isNaN(level)) return 0
  if (level < MIN_INDENT_LEVEL) return MIN_INDENT_LEVEL
  if (level > MAX_INDENT_LEVEL) return MAX_INDENT_LEVEL
  return Math.round(level)
}

// 默认缩进间隔
const DEFAULT_INDENT_SPACING = 2

type LogFunction = (message: string) => void

const createLogHandler = (
  message: string,
  logFn: LogFunction,
  icon: string = '',
  indentLevel: IndentLevel | number = 0,
  indentSpacing: number = DEFAULT_INDENT_SPACING
): void => {
  const safeIndentLevel = normalizeIndentLevel(indentLevel)
  // 确保indentSpacing至少为2，以便有足够的缩进
  const effectiveIndentSpacing = indentSpacing < 2 ? 2 : indentSpacing  
  const indent = ' '.repeat(safeIndentLevel * effectiveIndentSpacing)
  const lines = message.split('\n')
  lines.forEach((line: string, index: number) => {
    const prefix = index === 0 ? icon : ' '.repeat(icon.length)
    logFn(`${indent}${prefix}${line}`)
  })
}

// 为了保持向后兼容，保留原有的导出（不推荐直接用）
export const log = (message: string, indentLevel: IndentLevel | number = 0): void => {
  Logger.getInstance().log(message, indentLevel)
}

export const errorLog = (message: string, indentLevel: IndentLevel | number = 0): void => {
  Logger.getInstance().error(message, indentLevel)
}

export const successLog = (message: string, indentLevel: IndentLevel | number = 0): void => {
  Logger.getInstance().success(message, indentLevel)
}

export const warningLog = (message: string, indentLevel: IndentLevel | number = 0): void => {
  Logger.getInstance().warning(message, indentLevel)
}

/**
 * 基础日志管理器
 */
export class Logger {
  private static instance: Logger
  protected currentLogLevel: LogLevel = LogLevel.info
  protected indentSpacing: number = DEFAULT_INDENT_SPACING

  protected constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * 配置日志等级和缩进间隔
   * @param level 最大缩进等级（必传）
   * @param indentSpacing 缩进间隔（可选）
   */
  configureLogging(level: LogLevel, indentSpacing?: number) {
    this.currentLogLevel = level
    if (typeof indentSpacing === 'number') {
      this.indentSpacing = indentSpacing
    }
  }

  getLogLevel(): LogLevel {
    return this.currentLogLevel
  }

  getIndentSpacing(): number {
    return this.indentSpacing
  }

  static getIndentSpacing(): number {
    return Logger.getInstance().getIndentSpacing()
  }

  shouldLog(indentLevel: IndentLevel | number): boolean {
    return normalizeIndentLevel(indentLevel) <= this.currentLogLevel
  }

  // 日志方法：直接用传入的 indentLevel 作为最终缩进等级
  log(message: string, indentLevel: IndentLevel | number = 0): void {
    const safeIndentLevel = normalizeIndentLevel(indentLevel)
    if (this.shouldLog(safeIndentLevel)) {
      createLogHandler(message, console.log, '', safeIndentLevel, this.indentSpacing)
    }
  }

  error(message: string, indentLevel: IndentLevel | number = 0): void {
    const safeIndentLevel = normalizeIndentLevel(indentLevel)
    if (this.shouldLog(safeIndentLevel)) {
      createLogHandler(message, console.error, '❌  ', safeIndentLevel, this.indentSpacing)
    }
  }

  success(message: string, indentLevel: IndentLevel | number = 0): void {
    const safeIndentLevel = normalizeIndentLevel(indentLevel)
    if (this.shouldLog(safeIndentLevel)) {
      createLogHandler(message, console.log, '✅  ', safeIndentLevel, this.indentSpacing)
    }
  }

  warning(message: string, indentLevel: IndentLevel | number = 0): void {
    const safeIndentLevel = normalizeIndentLevel(indentLevel)
    if (this.shouldLog(safeIndentLevel)) {
      createLogHandler(message, console.warn, '⚠️  ', safeIndentLevel, this.indentSpacing)
    }
  }

  // 静态方法
  static log(message: string, indentLevel: IndentLevel | number = 0): void {
    Logger.getInstance().log(message, indentLevel)
  }
  static error(message: string, indentLevel: IndentLevel | number = 0): void {
    Logger.getInstance().error(message, indentLevel)
  }
  static success(message: string, indentLevel: IndentLevel | number = 0): void {
    Logger.getInstance().success(message, indentLevel)
  }
  static warning(message: string, indentLevel: IndentLevel | number = 0): void {
    Logger.getInstance().warning(message, indentLevel)
  }

  /**
   * 全局配置方法
   */
  static configureLogging(level: LogLevel, indentSpacing?: number) {
    Logger.getInstance().configureLogging(level, indentSpacing)
  }
}

// 导出基础单例实例
export const logger = Logger.getInstance()
