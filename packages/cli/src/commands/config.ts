import { Command } from 'commander'
import fs from 'fs'
import path from 'path'

interface Config {
  apiKey?: string
}

// 设置API密钥的公共函数
export function setApiKey(apiKey: string): boolean {
  if (!apiKey) {
    console.log('请提供API密钥')
    return false
  }

  try {
    const configPath = path.join(process.cwd(), '.notion2allrc')
    let config: Config = {}

    // 如果文件已存在，尝试读取现有配置
    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf8')
        if (fileContent && fileContent.trim() !== '') {
          config = JSON.parse(fileContent)
        }
      } catch (error) {
        console.warn(
          `警告: 读取现有配置文件时出错: ${error instanceof Error ? error.message : String(error)}`
        )
        // 出错时使用空对象继续
      }
    }

    // 更新配置
    config.apiKey = apiKey
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
    console.log('✅ API_KEY已成功设置')
    return true
  } catch (error) {
    console.error(`设置API_KEY时出错: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

export function configCommand(program: Command) {
  program
    .command('config')
    .description('配置API_KEY')
    .option('--api-key <key>', '设置Notion API密钥')
    .action((options: { apiKey?: string }) => {
      if (options.apiKey) {
        if (!setApiKey(options.apiKey)) {
          process.exit(1)
        }
      } else {
        console.log('请使用 --api-key 选项提供API密钥')
      }
    })
}
