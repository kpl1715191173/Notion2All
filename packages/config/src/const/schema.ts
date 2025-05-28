import { z } from 'zod'

// 页面配置 schema
export const PageSchema = z.union([
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
   * 是否开启页面下载缓存机制 = 默认 true
   * 在outputDir下元数据无篡改情况下，根据修改时间判断是否重新下载
   */
  enableCache: z.boolean().default(true),

  /**
   * 是否显示递归下载的日志信息 - 默认 false
   */
  logRecursive: z.boolean().default(false),

  /**
   * 并发处理页面的数量 - 默认 5
   * 0 表示不使用并发处理
   */
  concurrency: z.number().int().min(0).default(5),
})

// 认证配置
export const AuthConfigSchema = z.object({
  apiKey: z.string().optional(),
})

// 主配置
export const ConfigSchema = BackupConfigSchema.merge(AuthConfigSchema)
