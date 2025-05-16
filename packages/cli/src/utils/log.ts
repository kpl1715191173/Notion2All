export enum LogLevel {
  level0 = 0,
  level1 = 1,
  level2 = 2,
  level3 = 3,
  level4 = 4,
}

export const log = (message: string, level: LogLevel = LogLevel.level0): void => {
  const indent = ' '.repeat(level * 2)
  console.log(`${indent}${message}`)
}

export const errorLog = (message: string, level: LogLevel = LogLevel.level0): void => {
  const indent = ' '.repeat(level * 2)
  console.error(`${indent}❌  ${message}`)
}

export const successLog = (message: string, level: LogLevel = LogLevel.level0): void => {
  const indent = ' '.repeat(level * 2)
  console.log(`${indent}✅  ${message}`)
}

export const warningLog = (message: string, level: LogLevel = LogLevel.level0): void => {
  const indent = ' '.repeat(level * 2)
  console.warn(`${indent}⚠️ ${message}`)
}

/**
 * 关于 Emoji 的输出说明
 * Window Powershell 中
 * 数字1️⃣2️⃣...自带一个空格
 * ✅❌ 需要多增加一个空格
 */
