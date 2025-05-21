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

  async getPage(pageId: string): Promise<PageObjectResponse> {
    return this.client.pages.retrieve({ page_id: pageId }) as Promise<PageObjectResponse>
  }

  async getDatabase(databaseId: string): Promise<DatabaseObjectResponse> {
    return this.client.databases.retrieve({
      database_id: databaseId,
    }) as Promise<DatabaseObjectResponse>
  }

  async queryDatabase(databaseId: string) {
    return this.client.databases.query({
      database_id: databaseId,
    })
  }

  async getBlockChildren(blockId: string) {
    const response = await this.client.blocks.children.list({
      block_id: blockId,
    })
    return response.results
  }
}

export function createNotionApi(config: NotionApiConfig): NotionApi {
  return new NotionApi(config)
}
