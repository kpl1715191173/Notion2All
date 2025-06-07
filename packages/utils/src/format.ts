import { NotionBlock } from '@notion2all/core'

/**
 * 格式化页面 ID，确保使用带连字符的格式
 * @param id 页面ID或块ID
 * @returns 格式化后的ID
 */
export function formatId(id: string): string {
  if (id.includes('-')) return id
  return id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')
}

/**
 * 计时器工具
 * 用于测量操作执行时间
 */
export const timer = {
  /**
   * 开始计时
   * @returns 开始时间戳（纳秒级）
   */
  start: (): bigint => {
    return process.hrtime.bigint()
  },

  /**
   * 结束计时并计算经过的时间
   * @param startTime 开始时间戳
   * @returns 经过的时间（毫秒，格式化为字符串）
   */
  end: (startTime: bigint): string => {
    const endTime = process.hrtime.bigint()
    const timeInMs = Number(endTime - startTime) / 1_000_000
    return timeInMs.toFixed(2)
  },
}

/**
 * 检查块是否是子页面
 * @param block 块对象
 * @returns 是否是子页面
 */
export function isChildPage(block: NotionBlock): boolean {
  return block?.type === 'child_page'
}

/**
 * 检查块是否有子块
 * @param block 块对象
 * @returns 是否有子块
 */
export function hasChildren(block: NotionBlock): boolean {
  return block?.has_children === true
}
