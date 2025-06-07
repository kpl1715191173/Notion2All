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
