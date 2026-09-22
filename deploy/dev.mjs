import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {listenDiscover} from './discover.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const discover = listenDiscover(4310);

const child = spawn('pnpm', ['--filter', 'web', 'dev'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

function stop(signal) {
  child.kill(signal);
  discover.close();
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
child.on('exit', (code) => {
  discover.close();
  process.exit(code ?? 0);
});
