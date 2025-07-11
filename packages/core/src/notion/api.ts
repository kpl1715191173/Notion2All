import { Client } from '@notionhq/client'
import type { LogLevel } from '@notionhq/client'
import type { ClientOptions } from '@notionhq/client/build/src/Client'
import type {
  PageObjectResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'
import { createProxyAgent } from '@notion2all/utils'

export interface NotionApiConfig {
  auth: string
  logLevel?: LogLevel
  timeoutMs?: number
  proxyUrl?: string
}

export class NotionApi {
  private client: Client

  constructor(config: NotionApiConfig) {
    const clientOptions: ClientOptions = {
      auth: config.auth,
    }

    if (config.logLevel) {
      clientOptions.logLevel = config.logLevel
    }

    if (config.timeoutMs) {
      clientOptions.timeoutMs = config.timeoutMs
    }

    // 添加代理支持
    if (config.proxyUrl) {
      const proxyAgent = createProxyAgent({ proxyUrl: config.proxyUrl })
      if (proxyAgent) {
        clientOptions.agent = proxyAgent
      }
    }

    this.client = new Client(clientOptions)
  }

  async getPage(options: { pageId: string }): Promise<PageObjectResponse> {
    const { pageId } = options
    try {
      const response = await this.client.pages.retrieve({
        page_id: pageId,
      })
      return response as unknown as PageObjectResponse
    } catch (error) {
      console.error(`获取页面 ${pageId} 失败:`, error)
      throw error
    }
  }

  async getDatabase(options: { databaseId: string }): Promise<DatabaseObjectResponse> {
    const { databaseId } = options
    try {
      return (await this.client.databases.retrieve({
        database_id: databaseId,
      })) as unknown as Promise<DatabaseObjectResponse>
    } catch (error) {
      console.error(`获取数据库 ${databaseId} 失败:`, error)
      throw error
    }
  }

  async queryDatabase(options: { databaseId: string }) {
    const { databaseId } = options
    try {
      return await this.client.databases.query({
        database_id: databaseId,
      })
    } catch (error) {
      console.error(`查询数据库 ${databaseId} 失败:`, error)
      throw error
    }
  }

  async getBlockChildren(options: { blockId: string }) {
    const { blockId } = options
    try {
      const response = await this.client.blocks.children.list({
        block_id: blockId,
      })
      return response.results
    } catch (error) {
      console.error(`获取块 ${blockId} 的子块失败:`, error)
      throw error
    }
  }
}

export function createNotionApi(config: NotionApiConfig): NotionApi {
  const i = new NotionApi(config)
  console.log(i)
  return i
}
