import { Command } from 'commander';
import { setToken, clearToken, getToken, getBaseUrl } from '../lib/config.js';
import { validateToken } from '../lib/api-client.js';
import { success, error, info, warn } from '../lib/output.js';
import { handleError } from '../lib/errors.js';

export const authCommand = new Command('auth')
  .description('Manage authentication');

authCommand
  .command('token <token>')
  .description('Set personal access token')
  .action(async (token: string) => {
    try {
      // Validate token format
      if (!token.startsWith('pf_')) {
        error('Invalid token format. Token must start with "pf_"');
        process.exit(1);
      }

      setToken(token);
      success('Token saved successfully');

      // Optionally validate the token
      const baseUrl = getBaseUrl();
      if (baseUrl) {
        info('Validating token...');
        const valid = await validateToken();
        if (valid) {
          success('Token is valid');
        } else {
          warn('Token may be invalid or expired');
        }
      } else {
        warn('API base URL not configured. Run: probefish config set api.baseUrl <url>');
      }
    } catch (err) {
      handleError(err);
    }
  });

authCommand
  .command('logout')
  .description('Clear stored credentials')
  .action(() => {
    clearToken();
    success('Logged out successfully');
  });

authCommand
  .command('status')
  .description('Show current authentication status')
  .action(async () => {
    try {
      const token = getToken();
      const baseUrl = getBaseUrl();

      if (!token) {
        info('Not authenticated');
        info('Run: probefish auth token <token>');
        return;
      }

      info(`Token: ${token.slice(0, 10)}...${token.slice(-4)}`);

      if (!baseUrl) {
        warn('API base URL not configured');
        warn('Run: probefish config set api.baseUrl <url>');
        return;
      }

      info(`API URL: ${baseUrl}`);
      info('Validating token...');

      const valid = await validateToken();
      if (valid) {
        success('Token is valid');
      } else {
        error('Token is invalid or expired');
      }
    } catch (err) {
      handleError(err);
    }
  });
