/**
 * Notion API 客户端
 *
 * 封装Notion SDK的调用，提供数据访问方法
 */

import { Client } from '@notionhq/client'
import type { LogLevel } from '@notionhq/client'
import type { ClientOptions } from '@notionhq/client/build/src/client'
import type {
  PageObjectResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'

/**
 * Notion客户端配置选项
 */
export interface NotionClientConfig {
  /** Notion API密钥 */
  auth: string
  /** 日志级别 */
  logLevel?: LogLevel
  /** 超时时间（毫秒） */
  timeoutMs?: number
}

/**
 * 扩展的Notion客户端
 */
export class NotionClient {
  private client: Client

  /**
   * 创建一个新的Notion客户端实例
   * @param config 客户端配置
   */
  constructor(config: NotionClientConfig) {
    const clientOptions: ClientOptions = {
      auth: config.auth,
    }

    if (config.logLevel) {
      clientOptions.logLevel = config.logLevel
    }

    if (config.timeoutMs) {
      clientOptions.timeoutMs = config.timeoutMs
    }

    this.client = new Client(clientOptions)
  }

  /**
   * 获取页面内容
   * @param pageId 页面ID
   */
  async getPage(pageId: string): Promise<PageObjectResponse> {
    return this.client.pages.retrieve({ page_id: pageId }) as Promise<PageObjectResponse>
  }

  /**
   * 获取数据库内容
   * @param databaseId 数据库ID
   */
  async getDatabase(databaseId: string): Promise<DatabaseObjectResponse> {
    return this.client.databases.retrieve({
      database_id: databaseId,
    }) as Promise<DatabaseObjectResponse>
  }

  /**
   * 查询数据库中的内容
   * @param databaseId 数据库ID
   */
  async queryDatabase(databaseId: string) {
    return this.client.databases.query({
      database_id: databaseId,
    })
  }

  /**
   * 获取页面的所有子块
   * @param blockId 块ID或页面ID
   */
  async getBlockChildren(blockId: string) {
    const response = await this.client.blocks.children.list({
      block_id: blockId,
    })

    return response.results
  }
}

/**
 * 创建Notion客户端实例
 * @param config 客户端配置
 */
export function createNotionClient(config: NotionClientConfig): NotionClient {
  return new NotionClient(config)
}
