import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { join } from 'path';
import {
  setConfigValue,
  getConfigValue,
  getAllConfig,
  CONFIG_KEYS,
} from '../lib/config.js';
import { success, error, info } from '../lib/output.js';

export const configCommand = new Command('config')
  .description('Manage CLI configuration');

configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .addHelpText('after', `
Available keys:
  api.baseUrl     - API endpoint URL (required)
  output.format   - Default output format (table, json)
  output.color    - Enable colors (true, false)
`)
  .action((key: string, value: string) => {
    if (!CONFIG_KEYS.includes(key as (typeof CONFIG_KEYS)[number])) {
      error(`Unknown config key: ${key}`);
      info(`Available keys: ${CONFIG_KEYS.join(', ')}`);
      process.exit(1);
    }

    const result = setConfigValue(key, value);
    if (result) {
      success(`Set ${key} = ${value}`);
    } else {
      error(`Invalid value for ${key}`);
      process.exit(1);
    }
  });

configCommand
  .command('get <key>')
  .description('Get a configuration value')
  .action((key: string) => {
    const value = getConfigValue(key);
    if (value !== undefined) {
      console.log(value);
    } else {
      error(`Config key not set: ${key}`);
      process.exit(1);
    }
  });

configCommand
  .command('list')
  .description('List all configuration values')
  .action(() => {
    const config = getAllConfig();

    console.log('Current configuration:');
    console.log();
    console.log(`  api.baseUrl:    ${config.baseUrl ?? '(not set)'}`);
    console.log(`  output.format:  ${config.output.format}`);
    console.log(`  output.color:   ${config.output.color}`);
    console.log(`  token:          ${config.token ? '[set]' : '(not set)'}`);
  });

configCommand
  .command('init')
  .description('Create .probefishrc in current directory')
  .option('--base-url <url>', 'API base URL')
  .action((options: { baseUrl?: string }) => {
    const rcPath = join(process.cwd(), '.probefishrc');

    const config: Record<string, unknown> = {
      baseUrl: options.baseUrl ?? 'http://localhost:3000/api',
      output: {
        format: 'table',
        color: true,
      },
    };

    try {
      writeFileSync(rcPath, JSON.stringify(config, null, 2) + '\n');
      success(`Created ${rcPath}`);
      info('You can also set PROBEFISH_TOKEN environment variable for authentication');
    } catch (err) {
      error(`Failed to create .probefishrc: ${err instanceof Error ? err.message : 'Unknown error'}`);
      process.exit(1);
    }
  });
