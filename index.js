require('dotenv').config();
const fs = require('fs');
const path = require('path');

function getApiKey() {
  // 1. CLI配置文件读取
  const configPath = path.join(process.cwd(), '.notion2allrc');
  if (fs.existsSync(configPath)) {
    try {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      if (!fileContent || fileContent.trim() === '') {
        console.warn('警告: .notion2allrc 文件为空');
      } else {
        const config = JSON.parse(fileContent);
        if (config && config.apiKey) return config.apiKey;
      }
    } catch (error) {
      console.warn(`警告: 读取或解析 .notion2allrc 文件时出错: ${error.message}`);
    }
  }

  // 2. .env文件读取
  if (process.env.NOTION_API_KEY) return process.env.NOTION_API_KEY;

  // 3. 环境变量读取
  if (process.env.API_KEY) return process.env.API_KEY;

  return null;
}

const apiKey = getApiKey();
if (!apiKey) {
  console.error('API_KEY not found. Please set it via CLI command, .env file, or environment variable.');
  process.exit(1);
}

console.log('API_KEY loaded successfully:', apiKey); 