#!/usr/bin/env node

import { Command } from 'commander';
import { authCommand } from './commands/auth.js';
import { configCommand } from './commands/config.js';
import { listCommand } from './commands/list.js';
import { runCommand } from './commands/run.js';
import { exportCommand } from './commands/export.js';
import { addCommand } from './commands/add.js';
import { updateCommand } from './commands/update.js';
import { deleteCommand } from './commands/delete.js';

const program = new Command();

program
  .name('probefish')
  .description('CLI for Probefish - LLM prompt testing platform')
  .version('0.8.0');

// Register commands
program.addCommand(authCommand);
program.addCommand(configCommand);
program.addCommand(listCommand);
program.addCommand(runCommand);
program.addCommand(exportCommand);
program.addCommand(addCommand);
program.addCommand(updateCommand);
program.addCommand(deleteCommand);

program.parse();
