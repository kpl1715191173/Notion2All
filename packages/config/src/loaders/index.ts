import { config } from 'dotenv'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { Config, ConfigSchema } from '../types'
import { DEFAULT_CONFIG } from '../defaults'
import { register } from 'ts-node'

export class ConfigLoader {
  private static instance: ConfigLoader
  private config: Config | null = null
  private configPath: string | null = null

  private constructor() {
    // 加载环境变量
    config()
    // 注册 ts-node
    register()
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

    // 1. 加载默认配置
    const defaultConfig = DEFAULT_CONFIG

    // 2. 加载配置文件
    const fileConfig = this.loadConfigFile()

    // 3. 合并配置（优先级：配置文件 > 默认配置）
    const mergedConfig = {
      ...defaultConfig,
      ...fileConfig,
    }

    // 4. 验证配置
    const result = ConfigSchema.safeParse(mergedConfig)

    if (!result.success) {
      throw new Error(`配置验证失败: ${result.error.message}`)
    }

    this.config = result.data
    return this.config
  }

  // 获取配置文件路径
  getConfigPath(): string | null {
    return this.configPath
  }
}
