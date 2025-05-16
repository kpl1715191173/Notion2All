import { Command } from 'commander'
import { ConfigLoader } from '@notion2all/config'
import { ApiKeySource } from '@notion2all/config'

export function configCommand(program: Command) {
  program
    .command('config')
    .description('配置API_KEY')
    .option('--api-key <key>', '设置Notion API密钥')
    .option('--show', '显示当前API_KEY的来源')
    .action(async (options: { apiKey?: string; show?: boolean }) => {
      const configLoader = ConfigLoader.getInstance()

      if (options.show) {
        const apiKeyInfo = await configLoader.getApiKey()
        if (apiKeyInfo) {
          const sourceMap = {
            [ApiKeySource.ENV]: '环境变量',
            [ApiKeySource.RC_FILE]: '.notion2allrc 文件',
            [ApiKeySource.CONFIG_FILE]: '配置文件',
          }
          console.log(`当前API_KEY来源: ${sourceMap[apiKeyInfo.source]}`)
        } else {
          console.log('未找到API_KEY')
        }
        return
      }

      if (options.apiKey) {
        try {
          await configLoader.setApiKey(options.apiKey)
          console.log('✅ API_KEY已成功设置到 .notion2allrc 文件')
        } catch (error) {
          console.error(
            `设置API_KEY时出错: ${error instanceof Error ? error.message : String(error)}`
          )
          process.exit(1)
        }
      } else {
        console.log('请使用 --api-key 选项提供API密钥，或使用 --show 选项查看当前API_KEY来源')
      }
    })
}
