import { BlockObjectResponse } from '@notionhq/client/build/src/api-endpoints'

/**
 * Notion 块对象类型，扩展了原始类型以支持子块
 */
export type NotionBlock = BlockObjectResponse & {
  children?: NotionBlock[]
}

/**
 * Notion 页面数据对象接口
 */
export interface PageObject {
  id: string
  properties: Record<string, any>
  children: NotionBlock[]
  [key: string]: any
}

/**
 * 获取完整页面数据的选项
 */
export interface GetFullPageDataOptions {
  saveToFile?: boolean
  outputDir?: string
}

/**
 * 保存结果接口
 */
export interface SaveResult {
  success: boolean
  filePath?: string
  error?: string
}
