const config: BackupConfig = {
  pages: ['1664f1d48d2b80f9929ad415aa88b822'],
}

type BackupConfig = {
  /**
   * 需要保存的页面: 支持两种写法
   */
  pages:
    | {
        id: string
        name: string
      }[]
    | string[]
  /**
   * 保存的格式，默认是json(无论什么格式都会保存为json)
   */
  format?: 'json' | 'md' | 'obsidian'
  /**
   * 保存的目录，默认为 ./build/meta
   */
  outputDir?: string
  /**
   * 是否需要（下载）附件
   * onlyPic: 只下载图片 - 默认
   * all: 所有附件
   */
  includeAttachments?: 'all' | 'onlyPic'
  /**
   * 是否递归下载子页面 - 默认 true
   */
  recursive?: boolean
}

export default config
