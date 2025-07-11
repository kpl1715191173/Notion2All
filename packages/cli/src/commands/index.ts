import { Command } from 'commander'
import { configCommand } from './config'
import { backupCommand } from './backup'
import { testProxyCommand } from './test-proxy'

export function registerCommands(program: Command) {
  configCommand(program)
  backupCommand(program)
  testProxyCommand(program)
}
