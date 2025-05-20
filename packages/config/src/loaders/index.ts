import { config } from 'dotenv'
import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { Config, ConfigSchema, ApiKeyInfo, ApiKeySource } from '../types'
import { register } from 'ts-node'

export class ConfigLoader {
  private static instance: ConfigLoader
  private config: Config | null = null
  private configPath: string | null = null
  private rcFilePath: string | null = null

  private constructor() {
    // 加载环境变量
    config()
    // 注册 ts-node
    register()
    // 初始化 rc 文件路径
    this.rcFilePath = join(process.cwd(), '.notion2allrc')
  }

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader()
    }
    return ConfigLoader.instance
  }

  private findConfigFile(): string | null {
    let currentDir = process.cwd()
    const rootDir = process.platform === 'win32' ? currentDir.split('\\')[0] : '/'

    while (currentDir !== rootDir) {
      // 首先查找 backup_config.ts
      const backupConfigPath = join(currentDir, 'config', 'backup_config.ts')
      if (existsSync(backupConfigPath)) {
        return backupConfigPath
      }

      // 然后查找 notion2all.config.json
      const configPath = join(currentDir, 'notion2all.config.json')
      if (existsSync(configPath)) {
        return configPath
      }
      currentDir = dirname(currentDir)
    }

    return null
  }

  private loadRcFile(): Partial<Config> {
    try {
      if (existsSync(this.rcFilePath!)) {
        const content = readFileSync(this.rcFilePath!, 'utf-8').trim()
        // 如果文件为空，返回空对象
        if (!content) {
          return {}
        }
        return JSON.parse(content)
      }
    } catch (error) {
      // 如果是 JSON 解析错误，返回空对象
      if (error instanceof SyntaxError) {
        console.warn('警告: .notion2allrc 文件格式不正确，将使用空配置')
        return {}
      }
      console.warn('读取 .notion2allrc 文件失败:', error)
    }
    return {}
  }

  private loadTypeScriptConfig(configPath: string): Partial<Config> {
    try {
      return require(configPath).default
    } catch (error) {
      console.error('加载 TypeScript 配置文件失败:', error)
      return {}
    }
  }

  private loadConfigFile(): Partial<Config> {
    try {
      // 查找配置文件
      this.configPath = this.findConfigFile()

      if (!this.configPath) {
        console.warn('未找到配置文件 (backup_config.ts 或 notion2all.config.json)')
        return {}
      }

      if (this.configPath.endsWith('.ts')) {
        // 处理 TypeScript 配置文件
        return this.loadTypeScriptConfig(this.configPath)
      } else {
        // 处理 JSON 配置文件
        const configContent = readFileSync(this.configPath, 'utf-8')
        return JSON.parse(configContent)
      }
    } catch (error) {
      console.error('读取配置文件失败:', error)
      return {}
    }
  }

  async load(): Promise<Config> {
    if (this.config) {
      return this.config
    }

    // 1. 加载配置文件
    const fileConfig = this.loadConfigFile()

    // 2. 加载 rc 文件
    const rcConfig = this.loadRcFile()

    // 3. 合并配置（优先级：rc文件 > 配置文件）
    const mergedConfig = {
      ...fileConfig,
      ...rcConfig,
    }

    // 4. 验证配置并应用默认值
    const result = ConfigSchema.safeParse(mergedConfig)

    if (!result.success) {
      throw new Error(`配置验证失败: ${result.error.message}`)
    }

    this.config = result.data
    return this.config
  }

  async setApiKey(apiKey: string): Promise<void> {
    // 优先写入 rc 文件
    try {
      const rcConfig = this.loadRcFile()
      const updatedConfig = {
        ...rcConfig,
        apiKey,
      }
      // 确保目录存在
      const rcDir = dirname(this.rcFilePath!)
      if (!existsSync(rcDir)) {
        // 如果目录不存在，创建它
        require('fs').mkdirSync(rcDir, { recursive: true })
      }
      writeFileSync(this.rcFilePath!, JSON.stringify(updatedConfig, null, 2))
    } catch (error) {
      console.error('写入 .notion2allrc 文件失败:', error)
      throw error
    }

    // 更新内存中的配置
    if (this.config) {
      this.config.apiKey = apiKey
    }
  }

  async getApiKey(): Promise<ApiKeyInfo | undefined> {
    // 1. 首先检查环境变量
    const envApiKey = process.env.NOTION_API_KEY
    if (envApiKey) {
      return {
        key: envApiKey,
        source: ApiKeySource.ENV,
      }
    }

    // 2. 检查 rc 文件
    const rcConfig = this.loadRcFile()
    if (rcConfig.apiKey) {
      return {
        key: rcConfig.apiKey,
        source: ApiKeySource.RC_FILE,
      }
    }

    // 3. 检查配置文件
    const config = await this.load()
    if (config.apiKey) {
      return {
        key: config.apiKey,
        source: ApiKeySource.CONFIG_FILE,
      }
    }

    return undefined
  }

  // 获取配置文件路径
  getConfigPath(): string | null {
    return this.configPath
  }
}
