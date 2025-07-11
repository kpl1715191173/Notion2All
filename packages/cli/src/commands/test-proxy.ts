import { Command } from 'commander'
import { ConfigLoader } from '@notion2all/config'
import {
  NotionBackupLogger,
  LogLevel,
  configureLogging,
  IndentLevel,
  isValidProxyUrl,
  testProxyConnectivity,
} from '@notion2all/utils'
import { createBox } from '../utils'

export const testProxyCommand = (program: Command) => {
  program
    .command('test-proxy')
    .description('测试代理连接是否可用')
    .option('-p, --proxy <url>', '要测试的代理URL，默认使用配置文件中的代理')
    .option('-u, --url <url>', '测试连接的URL，默认为https://www.google.com')
    .option('-t, --timeout <ms>', '连接超时时间（毫秒），默认5000')
    .action(async options => {
      try {
        /**
         * ====== 加载配置 ======
         */
        // 加载配置
        const configLoader = ConfigLoader.getInstance()
        const config = await configLoader.load()

        configureLogging({
          level: LogLevel.info,
          baseIndentLevel: IndentLevel.L2,
        })

        const summaryMsg = await createBox({
          title: 'Notion2All代理测试',
          content: ['欢迎使用 Notion2All 代理测试工具', '用于测试代理服务器是否可用'],
          padding: { left: 10, right: 10 },
        })
        NotionBackupLogger.log(summaryMsg, IndentLevel.L0)
        NotionBackupLogger.log('\n')

        // 获取代理URL
        const proxyUrl = options.proxy || config.proxyUrl
        const testUrl = options.url || 'https://www.google.com'
        const timeout = options.timeout ? parseInt(options.timeout, 10) : 5000

        if (!proxyUrl) {
          NotionBackupLogger.log(
            '错误：未指定代理URL，请使用--proxy选项或在配置文件中设置proxyUrl',
            IndentLevel.L1
          )
          return
        }

        if (!isValidProxyUrl(proxyUrl)) {
          NotionBackupLogger.log(`错误：代理URL格式无效 - ${proxyUrl}`, IndentLevel.L1)
          NotionBackupLogger.log(
            '代理URL应该类似：http://host:port 或 https://host:port',
            IndentLevel.L1
          )
          return
        }

        const configMsg = await createBox({
          title: '测试配置',
          content: [
            `🔌 代理服务器: ${proxyUrl}`,
            `🌐 测试URL: ${testUrl}`,
            `⏱️ 超时时间: ${timeout}ms`,
          ],
          padding: { left: 5, right: 5 },
          options: {
            borderStyle: 'classic',
          },
        })

        NotionBackupLogger.log(configMsg + '\n', IndentLevel.L1)
        NotionBackupLogger.log('正在测试代理连通性...', IndentLevel.L1)

        const startTime = Date.now()
        const isProxyWorking = await testProxyConnectivity(proxyUrl, testUrl, timeout)
        const endTime = Date.now()
        const elapsedTime = endTime - startTime

        if (isProxyWorking) {
          NotionBackupLogger.success(
            `✅ 代理连接测试成功！响应时间：${elapsedTime}ms`,
            IndentLevel.L1
          )
        } else {
          NotionBackupLogger.log(`❌ 代理连接测试失败！耗时：${elapsedTime}ms`, IndentLevel.L1)
          NotionBackupLogger.log('可能的原因：', IndentLevel.L1)
          NotionBackupLogger.log(' - 代理服务器未运行或配置错误', IndentLevel.L2)
          NotionBackupLogger.log(' - 网络连接问题', IndentLevel.L2)
          NotionBackupLogger.log(' - 测试URL不可达', IndentLevel.L2)
          NotionBackupLogger.log(' - 超时时间过短', IndentLevel.L2)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        NotionBackupLogger.log(`测试过程中发生错误: ${errorMessage}`, IndentLevel.L1)
        process.exit(1)
      }
    })
}
