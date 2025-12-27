import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const distDir = join(process.cwd(), 'dist', 'cli');

// Ensure dist directory exists
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

console.log('Building CLI...');

// Build with esbuild
execSync(
  'npx esbuild cli/index.ts ' +
    '--bundle ' +
    '--platform=node ' +
    '--target=node18 ' +
    '--format=esm ' +
    '--outfile=dist/cli/index.js ' +
    '--external:conf ' +
    '--external:chalk ' +
    '--external:ora ' +
    '--external:commander',
  { stdio: 'inherit' }
);

// Add shebang to the output file
const outputPath = join(distDir, 'index.js');
const content = readFileSync(outputPath, 'utf-8');
if (!content.startsWith('#!/usr/bin/env node')) {
  writeFileSync(outputPath, '#!/usr/bin/env node\n' + content);
}

console.log('CLI built successfully!');
console.log('');
console.log('To test locally:');
console.log('  node dist/cli/index.js --help');
console.log('');
console.log('To install globally:');
console.log('  npm link');
