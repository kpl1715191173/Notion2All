import { Command } from 'commander'
import { ConfigLoader } from '@notion2all/config'
import { log, errorLog, successLog, warningLog, LogLevel } from '../utils'
import { Config } from '@notion2all/config'

export const backupCommand = (program: Command) => {
  program
    .command('backup')
    .description('Backup Notion pages to various formats')
    .option('-p, --page-id <id>', 'Notion page ID to backup')
    .option('-f, --format <format>', 'Export format (json, md, obsidian)')
    .option('-o, --output-dir <path>', 'Output directory path')
    .option('-a, --attachments <type>', 'Attachment handling (all, onlyPic)')
    .option('-r, --recursive', 'Recursively backup child pages')
    .option('--no-recursive', 'Do not recursively backup child pages')
    .action(async options => {
      try {
        log('👾 开始备份...')

        // 加载配置
        log('1️⃣正在加载配置...', LogLevel.level0)
        const configLoader = ConfigLoader.getInstance()
        const config = await configLoader.load()

        // 命令行参数覆盖配置
        if (options.format) config.format = options.format as Config['format']
        if (options.outputDir) config.outputDir = options.outputDir
        if (options.attachments)
          config.includeAttachments = options.attachments as Config['includeAttachments']
        if (options.recursive !== undefined) config.recursive = options.recursive
        if (options.pageId && config.pages.length === 0) {
          config.pages = [options.pageId]
        }

        log(`📁 配置文件路径: ${configLoader.getConfigPath()}`, LogLevel.level1)
        log('⚙️ 配置信息:', LogLevel.level1)

        // 格式化配置信息输出
        const formattedConfig = JSON.stringify(config, null, 2)
          .split('\n')
          .map((line, index) => (index === 0 ? line : `    ${line}`))
          .join('\n')

        log(formattedConfig, LogLevel.level2)

        if (config.pages.length > 0) {
          log('📄 备份页面:', LogLevel.level1)
          config.pages.forEach((page, index) => {
            const pageInfo = typeof page === 'string' ? page : `${page.name} (${page.id})`
            log(`${index + 1}. ${pageInfo}`, LogLevel.level2)
          })
        } else {
          warningLog('⚠️ 没有配置需要备份的页面', LogLevel.level1)
        }

        log(`📂 输出目录: ${config.outputDir}`, LogLevel.level1)
        log(`📎 附件处理: ${config.includeAttachments}`, LogLevel.level1)
        log(`🔄 递归备份: ${config.recursive ? '是' : '否'}`, LogLevel.level1)

        // TODO: 实现备份逻辑
        successLog('配置加载完成', LogLevel.level1)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        errorLog(`备份失败: ${errorMessage}`)
        process.exit(1)
      }
    })
}
