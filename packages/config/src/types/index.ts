import { z } from 'zod'
import { BackupConfigSchema, ConfigSchema } from '../const'

// 从 schema 推断类型
export type BackupConfig = z.input<typeof BackupConfigSchema>
export type FinalBackupConfig = z.output<typeof BackupConfigSchema>

export type Config = z.infer<typeof ConfigSchema>

// 重新导出 ConfigSchema
export { ConfigSchema }

// API KEY 来源
export enum ApiKeySource {
  ENV = 'env',
  CONFIG_FILE = 'config_file',
  RC_FILE = 'rc_file',
}

// API KEY 信息
export interface ApiKeyInfo {
  key: string
  source: ApiKeySource
}
