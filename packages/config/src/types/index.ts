import { z } from 'zod'

// 备份配置
export const BackupConfigSchema = z.object({
  pages: z.union([
    z.array(
      z.object({
        id: z.string(),
        name: z.string(),
      })
    ),
    z.array(z.string()),
  ]),
  format: z.enum(['json', 'md', 'obsidian']).default('json'),
  outputDir: z.string().default('./build/meta'),
  includeAttachments: z.enum(['all', 'onlyPic']).default('onlyPic'),
  recursive: z.boolean().default(true),
})

export type BackupConfig = z.infer<typeof BackupConfigSchema>

// 认证配置
export const AuthConfigSchema = z.object({
  apiKey: z.string().optional(),
})

// 主配置
export const ConfigSchema = BackupConfigSchema.merge(AuthConfigSchema)

export type Config = z.infer<typeof ConfigSchema>

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
