import { z } from 'zod'

// 页面配置 schema
const PageSchema = z.union([
  z.object({
    id: z.string(),
    name: z.string(),
  }),
  z.string(),
])

// 备份配置 schema
export const BackupConfigSchema = z.object({
  /**
   * 需要保存的页面: 支持两种写法
   */
  pages: z.array(PageSchema),
  /**
   * 保存的格式，默认是json(无论什么格式都会保存为json)
   */
  format: z.enum(['json', 'md', 'obsidian']).default('json'),
  /**
   * 保存的目录，默认为 ./build/meta
   */
  outputDir: z.string().default('./build/meta'),
  /**
   * 是否需要（下载）附件
   * onlyPic: 只下载图片 - 默认
   * all: 所有附件
   */
  includeAttachments: z.enum(['all', 'onlyPic']).default('onlyPic'),
  /**
   * 是否递归下载子页面 - 默认 true
   */
  recursive: z.boolean().default(true),

  /**
   * 是否显示递归下载的日志信息 - 默认 false
   */
  logRecursive: z.boolean().default(false),
})

// 从 schema 推断类型
export type BackupConfig = z.input<typeof BackupConfigSchema>
export type FinalBackupConfig = z.output<typeof BackupConfigSchema>

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
