/**
 * 通用工具函数
 */

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
 * 检查块是否是子页面
 * @param block 块对象
 * @returns 是否是子页面
 */
export function isChildPage(block: any): boolean {
  return block?.type === 'child_page'
}

/**
 * 检查块是否有子块
 * @param block 块对象
 * @returns 是否有子块
 */
export function hasChildren(block: any): boolean {
  return block?.has_children === true
} 