/**
 * 代理配置工具
 * 提供检测环境中的代理配置、创建代理等功能
 */
import https from 'https'
import { URL } from 'url'
import { HttpsProxyAgent } from 'https-proxy-agent'

/**
 * 代理配置选项
 */
export interface ProxyOptions {
  /**
   * 代理URL，格式为 http://host:port 或 https://host:port
   */
  proxyUrl?: string
}

/**
 * 检测环境变量中的代理配置
 * @returns 环境变量中的代理URL或undefined
 */
export function detectProxyFromEnv(): string | undefined {
  // 按照优先级顺序检查环境变量
  return (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  )
}

/**
 * 创建HTTPS代理Agent
 * @param options 代理配置选项
 * @returns 代理Agent或undefined（如果没有配置代理）
 */
export function createProxyAgent(options?: ProxyOptions): HttpsProxyAgent<string> | undefined {
  const proxyUrl = options?.proxyUrl || detectProxyFromEnv()

  if (!proxyUrl) {
    return undefined
  }

  try {
    return new HttpsProxyAgent(proxyUrl)
  } catch (error) {
    console.warn(`创建代理Agent失败: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

/**
 * 检查代理配置是否有效
 * @param proxyUrl 代理URL
 * @returns 是否有效
 */
export function isValidProxyUrl(proxyUrl?: string): boolean {
  if (!proxyUrl) return false

  try {
    // 尝试解析URL
    new URL(proxyUrl)
    // 检查协议
    return proxyUrl.startsWith('http://') || proxyUrl.startsWith('https://')
  } catch (error) {
    return false
  }
}

/**
 * 测试代理连通性
 * 尝试通过代理访问Google来检查代理是否可用
 *
 * @param proxyUrl 代理URL
 * @param testUrl 测试URL，默认为Google
 * @param timeoutMs 超时时间，单位毫秒，默认5秒
 * @returns Promise<boolean> 代理是否连通
 */
export async function testProxyConnectivity(
  proxyUrl: string,
  testUrl: string = 'https://www.google.com',
  timeoutMs: number = 5000
): Promise<boolean> {
  if (!isValidProxyUrl(proxyUrl)) {
    return false
  }

  return new Promise(resolve => {
    try {
      const proxyAgent = new HttpsProxyAgent(proxyUrl)
      const timeout = setTimeout(() => {
        resolve(false)
      }, timeoutMs)

      const req = https.get(
        testUrl,
        {
          agent: proxyAgent,
          timeout: timeoutMs,
        },
        res => {
          clearTimeout(timeout)
          // 2xx 和 3xx 状态码表示成功
          resolve(res.statusCode !== undefined && res.statusCode < 400)
        }
      )

      req.on('error', () => {
        clearTimeout(timeout)
        resolve(false)
      })

      req.on('timeout', () => {
        req.destroy()
        resolve(false)
      })
    } catch (error) {
      resolve(false)
    }
  })
}
