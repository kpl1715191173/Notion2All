import { Command } from 'commander'
import { Config, ConfigLoader } from '@notion2all/config'
import { createNotionApi, NotionPageSaver, SaveResult } from '@notion2all/core'
import { log, errorLog, LogLevel, successLog, warningLog } from '../utils'
import { createBox } from '../utils/boxen'

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
        const summartMsg = await createBox({
          title: 'Notion2All备份程序',
          content: [
            '欢迎使用 Notion2All 备份程序',
            '当前版本: 0.0.1',
            '项目地址: https://github.com/kpl1715191173/Notion2All',
          ],
          padding: { left: 10, right: 10 },
        })
        log(summartMsg, LogLevel.level0)
        log('\n')

        /**
         * ====== 加载配置 ======
         */
        log('🛑 [Step1] ------------------ 加载配置数据 ------------------', LogLevel.level0)
        const configLoader = ConfigLoader.getInstance()
        const config = await configLoader.load()

        const apiKeyInfo = await configLoader.getApiKey()
        if (!apiKeyInfo?.key) {
          errorLog('无法获取API_KEY，请检查后重试', LogLevel.level1)
        } else {
          successLog('API_KEY 检查通过', LogLevel.level1)
        }

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

        const boxedConfig = await createBox({
          title: '配置信息',
          content: [
            `📂 输出目录: ${config.outputDir}`,
            `📎 附件处理: ${config.includeAttachments}`,
            `🔄 递归备份: ${config.recursive ? '是' : '否'}`,
          ],
          padding: { left: 5, right: 5 },
          options: {
            borderStyle: 'classic',
          },
        })

        log(boxedConfig, LogLevel.level1)

        log(JSON.stringify(config, null, 2), LogLevel.level1)

        successLog('配置加载完成\n', LogLevel.level1)

        /**
         * ====== 备份逻辑 ======
         */
        log('🛑 [Step2] ------------------ 获取Notion数据 ------------------', LogLevel.level0)

        const notionApi = createNotionApi({
          auth: apiKeyInfo?.key!,
        })
        if (notionApi) {
          successLog('Notion SDK初始化成功', LogLevel.level1)
        }

        if (config.pages.length > 0) {
          log('📄 备份页面:', LogLevel.level1)
          for (const page of config.pages) {
            try {
              const pageId = typeof page === 'string' ? page : page.id
              log(`处理页面 ${pageId}...`, LogLevel.level2)

              const saver = new NotionPageSaver({
                outputDir: config.outputDir,
                logRecursive: config.logRecursive,
              })
              const results: SaveResult[] = await saver.savePageRecursively(pageId, notionApi)
              const failed = results.filter((r: SaveResult) => !r.success)
              if (failed.length > 0) {
                errorLog(
                  `页面 ${pageId} 备份部分失败: ${failed.map((f: SaveResult) => f.error).join('; ')}`,
                  LogLevel.level2
                )
              } else {
                successLog(`页面 ${pageId} 备份成功`, LogLevel.level2)
              }
            } catch (error) {
              errorLog(
                `处理页面 ${typeof page === 'string' ? page : page.id} 失败: ${error instanceof Error ? error.message : String(error)}`,
                LogLevel.level1
              )
            }
          }
        } else {
          warningLog('⚠️ 没有配置需要备份的页面', LogLevel.level1)
        }

        successLog('备份完成！', LogLevel.level0)
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err)
        errorLog(`备份失败: ${errorMessage}`)
        process.exit(1)
      }
    })
}
