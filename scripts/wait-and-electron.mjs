import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const DIST_INDEX = path.join(root, 'dist', 'index.html');

async function waitForFile(filePath, attempts = 120, intervalMs = 500) {
  for (let i = 0; i < attempts; i++) {
    try {
      await access(filePath);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error('App UI not built yet. Waiting for dist/index.html...');
}

console.log('Waiting for app build...');
await waitForFile(DIST_INDEX);
console.log('Launching Fog Build Advisor...');

const electronPath = require('electron');
const child = spawn(electronPath, ['.'], {
  cwd: root,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
