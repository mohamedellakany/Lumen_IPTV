#!/usr/bin/env node
// Starts the streaming proxy and the Expo web dev server together. Ctrl+C stops both.
import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['server/proxy.mjs'], { stdio: 'inherit' }),
  spawn('npx', ['expo', 'start', '--web'], { stdio: 'inherit', shell: process.platform === 'win32' }),
];

const stop = () => {
  for (const child of children) child.kill('SIGTERM');
  process.exit();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', stop);
