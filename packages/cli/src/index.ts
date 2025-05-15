#!/usr/bin/env node

import { Command } from 'commander'
import { backupCommand } from './commands/backup'

const program = new Command()

program
  .name('notion2all')
  .description('A tool to export Notion pages to various formats')
  .version('1.0.0')

// 备份命令
backupCommand(program)

program.parse()
