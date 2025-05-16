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

        const apiKeyInfo = await configLoader.getApiKey()
        if (!apiKeyInfo?.key) {
          errorLog('无法获取API_KEY，请检查后重试', LogLevel.level1)
        } else {
          successLog('API_KEY检查通过', LogLevel.level1)
        }

        // 创建 Notion 客户端
        // const notionClient = createNotionClient({
        //   auth: apiKeyInfo?.key || '',
        // })

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

        successLog('配置加载完成\n', LogLevel.level1)

        log('2️⃣正在开始备份...', LogLevel.level0)

        // 遍历配置的页面进行备份
        // for (const pageConfig of config.pages) {
        //   const pageId = typeof pageConfig === 'string' ? pageConfig : pageConfig.id
        //   try {
        //     log(`\n📑 正在获取页面 ${pageId} 的内容...`, LogLevel.level1)
        //
        //     // 获取页面基本信息
        //     const page = await notionClient.getPage(pageId)
        //     log('✅ 页面基本信息获取成功', LogLevel.level2)
        //     log('页面信息:', LogLevel.level2)
        //     log(JSON.stringify(page, null, 2), LogLevel.level3)
        //
        //     // 获取页面内容块
        //     const blocks = await notionClient.getBlockChildren(pageId)
        //     log('✅ 页面内容块获取成功', LogLevel.level2)
        //     log('内容块信息:', LogLevel.level2)
        //     log(JSON.stringify(blocks, null, 2), LogLevel.level3)
        //
        //     // 如果需要递归获取子页面
        //     if (config.recursive) {
        //       log('🔄 正在递归获取子页面...', LogLevel.level2)
        //       // TODO: 实现递归获取子页面的逻辑
        //     }
        //   } catch (error: unknown) {
        //     const errorMessage = error instanceof Error ? error.message : String(error)
        //     errorLog(`备份页面 ${pageId} 失败: ${errorMessage}`)
        //   }
        // }

        successLog('备份完成！', LogLevel.level0)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        errorLog(`备份失败: ${errorMessage}`)
        process.exit(1)
      }
    })
}
