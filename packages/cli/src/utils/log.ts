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
