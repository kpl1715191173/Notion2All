/**
 * Notion2All Core
 *
 * 核心功能包，提供Notion API交互和数据转换功能
 *
 * 主要功能模块：
 * 1. Notion服务类：提供与Notion交互的核心功能
 *    - NotionPageCoordinator: 页面协调器，负责协调数据获取、缓存和保存的流程
 *    - NotionDataFetcher: 数据获取器，负责从Notion API获取数据
 *    - NotionCacheService: 缓存服务，负责管理页面数据的本地缓存
 *    - NotionPageSaver: 页面保存器，负责将页面数据保存到本地文件系统
 *    - NotionFileDownloader: 文件下载器，负责下载和保存Notion页面中的文件
 *
 * 2. 数据转换器：将Notion数据转换为其他格式
 *    - JSON转Markdown
 *    - JSON转Obsidian格式
 *
 * 3. 工具函数：提供各种辅助功能
 */

// 导出所有类型
export * from './notion/types'

// 导出所有服务
export { NotionDataFetcher } from './notion/services/fetcher'
export { NotionCacheService } from './notion/services/cache'
export { NotionPageSaver } from './notion/services/saver'
export { NotionPageCoordinator } from './notion/services/coordinator'
export { NotionFileDownloader } from './notion/services/file-downloader'

// 导出工具函数 - 页面处理相关
// export { formatPageId, isChildPage, hasChildren } from './notion/page'

// 导出 API 接口
export * from './notion/api'

// 导出通用类型定义
export * from './types/index'

// 导出数据转换器 - 将Notion数据转换为其他格式
export * from './transformers/json-to-md'
export * from './transformers/json-to-obsidian'

// 以下是暂时注释掉的导出，避免重复或冲突
// export * from './utils/index'
// export * from './notion/page'
// export * from './notion/saver'
