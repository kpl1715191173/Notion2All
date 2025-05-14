#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 检查并安装依赖
function checkAndInstallDependencies() {
  try {
    if (!fs.existsSync('./node_modules')) {
      console.log('正在安装依赖...');
      execSync('pnpm install', { stdio: 'inherit' });
    }
  } catch (error) {
    console.error('安装依赖失败:', error);
    process.exit(1);
  }
}

// 检查并创建全局链接
function checkAndCreateGlobalLink() {
  try {
    console.log('正在创建全局链接...');
    execSync('pnpm link --global', { stdio: 'inherit' });
  } catch (error) {
    console.error('创建全局链接失败:', error);
    process.exit(1);
  }
}

// 设置API密钥的公共函数
function setApiKey(apiKey) {
  if (!apiKey) {
    console.log('请提供API密钥');
    return false;
  }

  try {
    const configPath = path.join(process.cwd(), '.notion2allrc');
    let config = {};
    
    // 如果文件已存在，尝试读取现有配置
    if (fs.existsSync(configPath)) {
      try {
        const fileContent = fs.readFileSync(configPath, 'utf8');
        if (fileContent && fileContent.trim() !== '') {
          config = JSON.parse(fileContent);
        }
      } catch (error) {
        console.warn(`警告: 读取现有配置文件时出错: ${error.message}`);
        // 出错时使用空对象继续
      }
    }
    
    // 更新配置
    config.apiKey = apiKey;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('✅ API_KEY已成功设置');
    return true;
  } catch (error) {
    console.error(`设置API_KEY时出错: ${error.message}`);
    return false;
  }
}

program
  .command('config')
  .description('配置API_KEY')
  .option('--api-key <key>', '设置Notion API密钥')
  .action((options) => {
    if (options.apiKey) {
      if (!setApiKey(options.apiKey)) {
        process.exit(1);
      }
    } else {
      console.log('请使用 --api-key 选项提供API密钥');
    }
  });

program.parse(process.argv);