import {spawnSync} from 'node:child_process';
import {cp, mkdir, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webDir = path.join(root, 'apps', 'web');
const nextBin = path.join(webDir, 'node_modules', 'next', 'dist', 'bin', 'next');

if (!existsSync(nextBin)) {
  console.error('Next.js is not installed. Run the launcher again so dependencies can finish installing.');
  process.exit(1);
}

const build = spawnSync(process.execPath, [nextBin, 'build'], {
  cwd: webDir,
  stdio: 'inherit',
  env: {...process.env, NODE_ENV: 'production'},
  windowsHide: true,
});
if (build.error) {
  console.error(build.error.message);
  process.exit(1);
}
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const from = path.join(webDir, 'out');
const to = path.join(root, 'dist', 'apps', 'web');
await rm(to, {recursive: true, force: true});
await mkdir(to, {recursive: true});
await cp(from, to, {recursive: true});
