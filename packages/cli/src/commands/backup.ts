import { Command } from 'commander'
import { Config, ConfigLoader } from '@notion2all/config'
import {
  createNotionApi,
  NotionCacheService,
  NotionDataFetcher,
  NotionPageCoordinator,
  NotionPageSaver,
} from '@notion2all/core'
import {
  NotionBackupLogger,
  LogLevel,
  configureLogging,
  logger,
  IndentLevel,
  isValidProxyUrl,
  testProxyConnectivity,
} from '@notion2all/utils'
import { createBox } from '../utils'
import type { LogLevel as NotionLogLevel } from '@notionhq/client'

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
    .option('--cache', '启用缓存功能（默认）')
    .option('--no-cache', '禁用缓存功能，每次都重新下载页面数据')
    .option('--test-proxy', '测试代理连接是否有效')
    .action(async options => {
      try {
        /**
         * ====== 加载配置 ======
         */
        // 加载配置
        const configLoader = ConfigLoader.getInstance()
        const config = await configLoader.load()

        configureLogging({
          level: config.logLevel as LogLevel,
          baseIndentLevel: IndentLevel.L2,
          // indentSpacing: 2
        })

        const summaryMsg = await createBox({
          title: 'Notion2All备份程序',
          content: [
            '欢迎使用 Notion2All 备份程序',
            '当前版本: 0.0.1',
            '项目地址: https://github.com/kpl1715191173/Notion2All',
          ],
          padding: { left: 10, right: 10 },
        })
        NotionBackupLogger.log(summaryMsg, IndentLevel.L0)
        NotionBackupLogger.log('\n')

        NotionBackupLogger.log(
          '🛑 [Step1] ------------------ 加载配置数据 ------------------',
          IndentLevel.L0
        )

        const apiKeyInfo = await configLoader.getApiKey()
        if (!apiKeyInfo?.key) {
          logger.error('无法获取API_KEY，请检查后重试', IndentLevel.L1)
        } else {
          NotionBackupLogger.success('API_KEY 检查通过', IndentLevel.L1)
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
        // 处理缓存选项
        if (options.cache !== undefined) {
          config.enableCache = options.cache
        }

        NotionBackupLogger.log(`📁 配置文件路径: ${configLoader.getConfigPath()}`, IndentLevel.L1)

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
            ` 💾 启用缓存: ${config.enableCache ? '是' : '否'}`,
            config.proxyUrl ? ` 🔌 代理服务器: ${config.proxyUrl}` : '',
            '',
            '📶 Log输出配置:',
            logConfig.length > 0 ? logConfig.join('\n') : ' 无',
          ],
          padding: { left: 5, right: 5 },
          options: {
            borderStyle: 'classic',
          },
        })

        NotionBackupLogger.log(configMsg + '\n', IndentLevel.L1)

        if (logDetails) {
          NotionBackupLogger.log(JSON.stringify(config, null, 2), IndentLevel.L1)
          NotionBackupLogger.success('配置加载完成\n', IndentLevel.L1)
        }

        /**
         * ====== 备份逻辑 ======
         */
        NotionBackupLogger.log(
          '🛑 [Step2] ------------------ 获取Notion数据 ------------------',
          IndentLevel.L0
        )

        // 创建Notion API配置
        const notionApiCfg: {
          auth: string
          timeoutMs: number
          logLevel: NotionLogLevel
          proxyUrl?: string
        } = {
          auth: apiKeyInfo?.key!,
          timeoutMs: 30000,
          logLevel: config.logNotionLevel as NotionLogLevel,
        }

        // 如果指定了代理，添加代理配置
        if (config.proxyUrl && isValidProxyUrl(config.proxyUrl)) {
          notionApiCfg.proxyUrl = config.proxyUrl
          NotionBackupLogger.log(`使用代理服务器: ${config.proxyUrl}`, IndentLevel.L1)
        }

        const notionApi = createNotionApi(notionApiCfg)

        if (notionApi) {
          NotionBackupLogger.success('Notion SDK初始化成功', IndentLevel.L1)
        }

        if (config.pages.length > 0) {
          NotionBackupLogger.log('📥 开始备份页面', IndentLevel.L1)

          // 创建共享服务实例
          const fetcher = new NotionDataFetcher(notionApi)
          const cacheService = new NotionCacheService(config.outputDir)
          const saver = new NotionPageSaver(config.outputDir)

          // 根页面并发处理
          const concurrency = config.concurrency || 5 // 默认值为5

          if (concurrency <= 0) {
            // 串行处理根页面
            NotionBackupLogger.log(
              `🔜 串行处理: 开始处理 ${config.pages.length} 个根页面`,
              IndentLevel.L1
            )
            const startTime = timer.start()

            for (const page of config.pages) {
              try {
                const pageId = typeof page === 'string' ? page : page.id
                NotionBackupLogger.log(`📄 处理页面 ${pageId}...`, IndentLevel.L1)

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
                    enableCache: config.enableCache,
                  },
                })

                try {
                  await coordinator.processPage({ pageId, isRoot: true })
                  NotionBackupLogger.success(`页面 ${pageId} 备份完成`, IndentLevel.L1)
                } catch (error) {
                  logger.error(
                    `页面 ${pageId} 备份失败: ${error instanceof Error ? error.message : String(error)}`
                  )
                  throw error
                }
              } catch (error) {
                logger.error(
                  `处理页面 ${typeof page === 'string' ? page : page.id} 失败: ${error instanceof Error ? error.message : String(error)}`
                )
              }
            }

            const timeUsed = timer.end(startTime)
            NotionBackupLogger.success(
              `[串行处理] 完成处理 ${config.pages.length} 个根页面，耗时: ${timeUsed} ms`,
              IndentLevel.L1
            )
          } else {
            // 并发处理根页面，但限制并发数
            NotionBackupLogger.log(
              `🔜 并发处理: 处理 ${config.pages.length} 个根页面【并发数 ${concurrency}】`,
              IndentLevel.L1
            )
            const startTime = timer.start()

            // 分批处理根页面
            for (let i = 0; i < config.pages.length; i += concurrency) {
              const batch = config.pages.slice(i, i + concurrency)

              const pagePromises = batch.map(async page => {
                try {
                  const pageId = typeof page === 'string' ? page : page.id
                  NotionBackupLogger.log(`📄 处理页面 ${pageId}...`, IndentLevel.L1)

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
                      enableCache: config.enableCache,
                    },
                  })

                  await coordinator.processPage({ pageId, isRoot: true })
                  NotionBackupLogger.success(`页面 ${pageId} 备份完成`, IndentLevel.L1)
                } catch (error) {
                  logger.error(
                    `处理页面 ${typeof page === 'string' ? page : page.id} 失败: ${error instanceof Error ? error.message : String(error)}`
                  )
                }
              })

              await Promise.all(pagePromises)
            }

            const timeUsed = timer.end(startTime)
            NotionBackupLogger.success(
              `[并发处理] 完成处理 ${config.pages.length} 个根页面，耗时: ${timeUsed} ms`,
              IndentLevel.L1
            )
          }
        } else {
          NotionBackupLogger.log(
            '没有指定要备份的页面，请在配置文件中添加或使用 --page-id 参数指定',
            IndentLevel.L1
          )
        }

        NotionBackupLogger.success('🎉 备份完成!', IndentLevel.L0)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        logger.error(`备份失败: ${errorMessage}`, IndentLevel.L1)
        process.exit(1)
      }
    })
}
