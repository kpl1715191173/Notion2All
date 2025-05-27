import type { Options } from 'boxen' assert { 'resolution-mode': 'import' }

export interface BoxenConfig {
  content: string | string[]
  title?: string
  options?: Partial<Options>
  padding?: number | { top?: number; right?: number; bottom?: number; left?: number }
  margin?: number | { top?: number; right?: number; bottom?: number; left?: number }
}

let boxenModule: any = null

/**
 * 创建一个带有边框的文本框
 * @param config 配置对象
 * @returns 格式化后的文本
 */
export async function createBox(config: BoxenConfig): Promise<string> {
  if (!boxenModule) {
    boxenModule = await import('boxen')
  }

  const content = Array.isArray(config.content) ? config.content.join('\n') : config.content

  // 处理 padding
  let padding: number | { top: number; right: number; bottom: number; left: number }
  if (typeof config.padding === 'object') {
    padding = {
      top: config.padding.top ?? 1,
      right: config.padding.right ?? 3,
      bottom: config.padding.bottom ?? 1,
      left: config.padding.left ?? 3,
    }
  } else {
    padding = config.padding ?? 3
  }

  // 处理 margin
  let margin: number | { top: number; right: number; bottom: number; left: number }
  if (typeof config.margin === 'object') {
    margin = {
      top: config.margin.top ?? 0,
      right: config.margin.right ?? 0,
      bottom: config.margin.bottom ?? 0,
      left: config.margin.left ?? 0,
    }
  } else {
    margin = config.margin ?? 0
  }

  const options = {
    padding,
    margin,
    borderStyle: 'round',
    ...(config.options || {}),
  }

  if (config.title) {
    Object.assign(options, {
      title: config.title,
      titleAlignment: 'center',
    })
  }

  return boxenModule.default(content, options)
}
