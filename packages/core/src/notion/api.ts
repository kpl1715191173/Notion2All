import { Client } from '@notionhq/client'
import type { LogLevel } from '@notionhq/client'
import type { ClientOptions } from '@notionhq/client/build/src/client'
import type {
  PageObjectResponse,
  DatabaseObjectResponse,
} from '@notionhq/client/build/src/api-endpoints'

export interface NotionApiConfig {
  auth: string
  logLevel?: LogLevel
  timeoutMs?: number
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

    this.client = new Client(clientOptions)
  }

  async getPage(options: { pageId: string }): Promise<PageObjectResponse> {
    const { pageId } = options;
    return this.client.pages.retrieve({ page_id: pageId }) as Promise<PageObjectResponse>
  }

  async getDatabase(options: { databaseId: string }): Promise<DatabaseObjectResponse> {
    const { databaseId } = options;
    return this.client.databases.retrieve({
      database_id: databaseId,
    }) as Promise<DatabaseObjectResponse>
  }

  async queryDatabase(options: { databaseId: string }) {
    const { databaseId } = options;
    return this.client.databases.query({
      database_id: databaseId,
    })
  }

  async getBlockChildren(options: { blockId: string }) {
    const { blockId } = options;
    const response = await this.client.blocks.children.list({
      block_id: blockId,
    })
    return response.results
  }
}

export function createNotionApi(config: NotionApiConfig): NotionApi {
  return new NotionApi(config)
}
