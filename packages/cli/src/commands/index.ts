import { Command } from 'commander'
import { configCommand } from './config'
import { backupCommand } from './backup'

export function registerCommands(program: Command) {
  configCommand(program)
  backupCommand(program)
}
