import { Command } from 'commander'
import { Config, ConfigLoader } from '@notion2all/config'
import {
  createNotionApi,
  NotionCacheService,
  NotionDataFetcher,
  NotionPageCoordinator,
  NotionPageSaver,
} from '@notion2all/core'
import { Logger, LogLevel } from '@notion2all/utils'
import { createBox } from '../utils'

// 计时器工具函数
const timer = {
  start: () => {
    return process.hrtime.bigint()
  },
  end: (startTime: bigint) => {
    const endTime = process.hrtime.bigint()
    const timeInMs = Number(endTime - startTime) / 1_000_000
    return timeInMs.toFixed(2)
  },
}

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
    .option('-l, --log-recursive', '是否记录递归过程')
    .option('-c, --concurrency <number>', '并发处理页面的数量 (0表示串行处理)')
    // .option('--log-level <level>', '日志级别 (0-4)')
    .action(async options => {
      try {
        /**
         * ====== 加载配置 ======
         */
        const configLoader = ConfigLoader.getInstance()
        const config = await configLoader.load()
        // 设置全局日志级别
        const logLevel = config.logLevel as LogLevel
        Logger.getInstance().setLogLevel(logLevel)

        const summaryMsg = await createBox({
          title: 'Notion2All备份程序',
          content: [
            '欢迎使用 Notion2All 备份程序',
            '当前版本: 0.0.1',
            '项目地址: https://github.com/kpl1715191173/Notion2All',
          ],
          padding: { left: 10, right: 10 },
        })
        Logger.log(summaryMsg, LogLevel.level0)
        Logger.log('\n')

        Logger.log('🛑 [Step1] ------------------ 加载配置数据 ------------------', LogLevel.level0)

        const apiKeyInfo = await configLoader.getApiKey()
        if (!apiKeyInfo?.key) {
          Logger.error('无法获取API_KEY，请检查后重试', LogLevel.level1)
        } else {
          Logger.success('API_KEY 检查通过', LogLevel.level1)
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
        if (options.concurrency) {
          config.concurrency = parseInt(options.concurrency, 10)
        }

        Logger.log(`📁 配置文件路径: ${configLoader.getConfigPath()}`, LogLevel.level1)

        const logDetails = config.logDetails

        const logConfig: string[] = []
        if (logDetails) logConfig.push(' ❇️ 显示完整版的日志')
        const configMsg = await createBox({
          title: '配置信息',
          content: [
            '📶 基本配置:',
            ` 📂 输出目录: ${config.outputDir}`,
            ` 📎 附件处理: ${config.includeAttachments}`,
            ` 🔄 递归备份: ${config.recursive ? '是' : '否'}`,
            ` 🚀 并发数量: ${config.concurrency}${config.concurrency === 0 ? ' (串行处理)' : ''}`,
            '',
            '📶 Log输出配置:',
            logConfig.length > 0 ? logConfig.join('\n') : ' 无',
          ],
          padding: { left: 5, right: 5 },
          options: {
            borderStyle: 'classic',
          },
        })

        Logger.log(configMsg + '\n', LogLevel.level1)

        if (logDetails) {
          Logger.log(JSON.stringify(config, null, 2), LogLevel.level1)
          Logger.success('配置加载完成\n', LogLevel.level1)
        }

        /**
         * ====== 备份逻辑 ======
         */
        Logger.log(
          '🛑 [Step2] ------------------ 获取Notion数据 ------------------',
          LogLevel.level0
        )

        const notionApi = createNotionApi({
          auth: apiKeyInfo?.key!,
        })
        if (notionApi) {
          Logger.success('Notion SDK初始化成功', LogLevel.level1)
        }

        if (config.pages.length > 0) {
          Logger.log('📥 开始备份页面:', LogLevel.level1)

          // 创建共享服务实例
          const fetcher = new NotionDataFetcher(notionApi)
          const cacheService = new NotionCacheService(config.outputDir)
          const saver = new NotionPageSaver(config.outputDir)

          // 根页面并发处理
          const concurrency = config.concurrency || 5 // 默认值为5

          if (concurrency <= 0) {
            // 串行处理根页面
            Logger.log(`🔜 串行处理: 开始处理 ${config.pages.length} 个根页面`, LogLevel.level1)
            const startTime = timer.start()

            for (const page of config.pages) {
              try {
                const pageId = typeof page === 'string' ? page : page.id
                Logger.log(`📄 处理页面 ${pageId}...`, LogLevel.level2)

                // 创建协调器实例
                const coordinator = new NotionPageCoordinator({
                  fetcher,
                  cacheService,
                  saver,
                  config: {
                    recursive: config.recursive,
                    includeImages:
                      config.includeAttachments === 'onlyPic' ||
                      config.includeAttachments === 'all',
                    concurrency: config.concurrency,
                    logLevel: parseInt(options.logLevel, 10) as LogLevel,
                  },
                })

                try {
                  await coordinator.processPage({ pageId })
                  Logger.success(`页面 ${pageId} 备份完成`, LogLevel.level2)
                } catch (error) {
                  Logger.error(
                    `页面 ${pageId} 备份失败: ${error instanceof Error ? error.message : String(error)}`,
                    LogLevel.level2
                  )
                  throw error
                }
              } catch (error) {
                Logger.error(
                  `处理页面 ${typeof page === 'string' ? page : page.id} 失败: ${error instanceof Error ? error.message : String(error)}`,
                  LogLevel.level1
                )
              }
            }

            const timeUsed = timer.end(startTime)
            Logger.success(
              `[串行处理] 完成处理 ${config.pages.length} 个根页面，耗时: ${timeUsed} ms`,
              LogLevel.level1
            )
          } else {
            // 并发处理根页面，但限制并发数
            Logger.log(
              `🔜 并发处理: 处理 ${config.pages.length} 个根页面【并发数 ${concurrency}】`,
              LogLevel.level1
            )
            const startTime = timer.start()

            // 分批处理根页面
            for (let i = 0; i < config.pages.length; i += concurrency) {
              const batch = config.pages.slice(i, i + concurrency)

              const pagePromises = batch.map(async page => {
                try {
                  const pageId = typeof page === 'string' ? page : page.id
                  Logger.log(`📄 处理页面 ${pageId}...`, LogLevel.level1)

                  // 创建协调器实例
                  const coordinator = new NotionPageCoordinator({
                    fetcher,
                    cacheService,
                    saver,
                    config: {
                      recursive: config.recursive,
                      includeImages:
                        config.includeAttachments === 'onlyPic' ||
                        config.includeAttachments === 'all',
                      concurrency: config.concurrency,
                      logLevel: options.logRecursive
                        ? LogLevel.level2
                        : (parseInt(options.logLevel, 10) as LogLevel),
                    },
                  })

                  await coordinator.processPage({ pageId })
                  Logger.success(`页面 ${pageId} 备份完成`, LogLevel.level2)
                } catch (error) {
                  Logger.error(
                    `处理页面 ${typeof page === 'string' ? page : page.id} 失败: ${
                      error instanceof Error ? error.message : String(error)
                    }`,
                    LogLevel.level1
                  )
                }
              })

              await Promise.all(pagePromises)
            }

            const timeUsed = timer.end(startTime)
            Logger.success(
              `[并发处理] 完成处理 ${config.pages.length} 个根页面，耗时: ${timeUsed} ms`,
              LogLevel.level1
            )
          }
        } else {
          Logger.warning(
            '没有指定要备份的页面，请在配置文件中添加或使用 --page-id 参数指定',
            LogLevel.level1
          )
        }

        Logger.success('🎉 备份完成!', LogLevel.level0)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        Logger.error(`备份失败: ${errorMessage}`)
        process.exit(1)
      }
    })
}
