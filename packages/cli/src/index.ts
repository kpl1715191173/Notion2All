#!/usr/bin/env node

import { Command } from 'commander'
import { registerCommands } from './commands'

const program = new Command()

program
  .name('notion2all')
  .description('A tool to export Notion pages to various formats')
  .version('1.0.0')

// 注册所有命令
registerCommands(program)

program.parse()
