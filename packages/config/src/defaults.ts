import { Config } from './types'

export const DEFAULT_CONFIG: Config = {
  pages: [],
  format: 'json',
  outputDir: './build/meta',
  includeAttachments: 'onlyPic',
  recursive: true,
  apiKey: undefined,
}
