import chalk from 'chalk';

export class CLIError extends Error {
  constructor(
    message: string,
    public exitCode: number = 1
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export class AuthError extends CLIError {
  constructor(message: string = 'Authentication required. Run: probefish auth token <token>') {
    super(message, 2);
    this.name = 'AuthError';
  }
}

export class ConfigError extends CLIError {
  constructor(message: string) {
    super(message, 2);
    this.name = 'ConfigError';
  }
}

export class ApiError extends CLIError {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message, statusCode >= 500 ? 2 : 1);
    this.name = 'ApiError';
  }
}

export function handleError(error: unknown): never {
  if (error instanceof CLIError) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(chalk.red(`Error: ${error.message}`));
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }

  console.error(chalk.red('An unexpected error occurred'));
  process.exit(1);
}

export function exitWithError(message: string, exitCode: number = 1): never {
  console.error(chalk.red(`Error: ${message}`));
  process.exit(exitCode);
}
