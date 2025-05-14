/**
 * 工具函数
 */

/**
 * 生成安全的文件名
 * @param title 原始标题
 * @returns 安全的文件名
 */
export function safeFilename(title: string): string {
  return title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-') // 替换Windows不允许的字符
    .replace(/\s+/g, '-')                    // 将空格替换为连字符
    .replace(/-+/g, '-')                     // 删除多余的连字符
    .trim();
}

/**
 * 格式化日期
 * @param dateString 日期字符串或Date对象
 * @param format 格式字符串 (默认: 'YYYY-MM-DD')
 * @returns 格式化后的日期字符串
 */
export function formatDate(dateString: string | Date, format = 'YYYY-MM-DD'): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  
  const tokens: Record<string, () => string> = {
    YYYY: () => date.getFullYear().toString(),
    MM: () => (date.getMonth() + 1).toString().padStart(2, '0'),
    DD: () => date.getDate().toString().padStart(2, '0'),
    HH: () => date.getHours().toString().padStart(2, '0'),
    mm: () => date.getMinutes().toString().padStart(2, '0'),
    ss: () => date.getSeconds().toString().padStart(2, '0')
  };
  
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, match => tokens[match]());
}

/**
 * 检查文本是否为URL
 * @param text 要检查的文本
 * @returns 是否为URL
 */
export function isUrl(text: string): boolean {
  try {
    new URL(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * 延时函数
 * @param ms 延迟毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 批量处理数组
 * @param array 原始数组
 * @param batchSize 每批的大小
 * @param callback 处理函数
 */
export async function processBatch<T, R>(
  array: T[], 
  batchSize: number,
  callback: (items: T[]) => Promise<R[]>
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < array.length; i += batchSize) {
    const batch = array.slice(i, i + batchSize);
    const batchResults = await callback(batch);
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * 深度合并对象
 * @param target 目标对象
 * @param source 源对象
 * @returns 合并后的对象
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      if (
        source[key] !== null &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = deepMerge(
          Object.prototype.hasOwnProperty.call(target, key) ? target[key] : {},
          source[key]
        );
      } else {
        result[key] = source[key] as any;
      }
    }
  }
  
  return result;
}

/**
 * 创建一个异步锁
 * @returns 带有锁功能的对象
 */
export function createAsyncLock() {
  let isLocked = false;
  const queue: (() => void)[] = [];
  
  return {
    /**
     * 获取锁
     */
    async acquire(): Promise<void> {
      return new Promise<void>(resolve => {
        if (!isLocked) {
          isLocked = true;
          resolve();
        } else {
          queue.push(resolve);
        }
      });
    },
    
    /**
     * 释放锁
     */
    release(): void {
      if (queue.length > 0) {
        const next = queue.shift();
        if (next) next();
      } else {
        isLocked = false;
      }
    },
    
    /**
     * 在锁内执行函数
     * @param fn 要执行的函数
     */
    async withLock<T>(fn: () => Promise<T>): Promise<T> {
      await this.acquire();
      try {
        return await fn();
      } finally {
        this.release();
      }
    }
  };
} 