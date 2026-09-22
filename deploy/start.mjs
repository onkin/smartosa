import {handleDiscover} from './discover.mjs';
import {spawn, spawnSync} from 'node:child_process';
import {createReadStream, existsSync, statSync} from 'node:fs';
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const webRoot = path.join(root, 'dist', 'apps', 'web');
const port = 4300;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: {...process.env, ...extraEnv},
    windowsHide: true,
  });
  if (result.error) {
    fail(result.error.message);
  }
  if (result.status !== 0) {
    fail(`Command stopped: ${command} ${args.join(' ')}`);
  }
}

function bundledTool(parts) {
  const directory = path.dirname(process.execPath);
  const candidates = [
    path.join(directory, ...parts),
    path.join(directory, '..', 'lib', ...parts),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function runPnpm(args) {
  const corepack = bundledTool(['node_modules', 'corepack', 'dist', 'corepack.js']);
  if (corepack) {
    run(process.execPath, [corepack, 'pnpm', ...args], {COREPACK_ENABLE_DOWNLOAD_PROMPT: '0'});
    return;
  }
  const pnpmJs = path.join(root, 'deploy', '.tools', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs');
  if (!existsSync(pnpmJs)) {
    const npm = bundledTool(['node_modules', 'npm', 'bin', 'npm-cli.js']);
    if (!npm) {
      fail('This Node.js has no pnpm, corepack, or npm.');
    }
    console.log('Installing pnpm…');
    run(process.execPath, [npm, 'install', 'pnpm@8.15.0', '--prefix', path.join(root, 'deploy', '.tools')]);
  }
  run(process.execPath, [pnpmJs, ...args]);
}

function lanAddresses() {
  const addresses = [];
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function fileFor(urlPath) {
  let decoded = decodeURIComponent((urlPath ?? '/').split('?')[0]);
  if (decoded.includes('\0') || decoded.includes('..')) {
    return null;
  }
  const relative = decoded.replace(/^[/\\]+/, '');
  const candidates = relative === '' ? ['index.html'] : [relative, `${relative}.html`, path.join(relative, 'index.html')];
  for (const candidate of candidates) {
    const full = path.resolve(webRoot, candidate);
    if (!full.startsWith(`${webRoot}${path.sep}`) || !existsSync(full) || !statSync(full).isFile()) {
      continue;
    }
    return full;
  }
  const missing = path.join(webRoot, '404.html');
  return existsSync(missing) ? missing : null;
}

const major = Number(process.versions.node.split('.')[0]);
if (major < 20) {
  fail(`Node.js 20 or newer is required. This machine has ${process.version}. https://nodejs.org`);
}

console.log('Installing dependencies…');
runPnpm(['install']);
console.log('Starting go2rtc…');
if (process.platform === 'win32') {
  const binDir = path.join(root, 'deploy', 'go2rtc', 'bin');
  const exe = path.join(binDir, 'go2rtc.exe');
  const configDir = path.join(root, 'deploy', 'go2rtc', 'config');
  const config = path.join(configDir, 'go2rtc.yaml');
  spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `New-Item -ItemType Directory -Force -Path '${binDir}','${configDir}' | Out-Null; if (-not (Test-Path '${config}')) { Copy-Item '${path.join(configDir, 'go2rtc.yaml.example')}' '${config}' }; if (-not (Test-Path '${exe}')) { $zip = '${path.join(binDir, 'go2rtc.zip')}'; Invoke-WebRequest -Uri 'https://github.com/AlexxIT/go2rtc/releases/latest/download/go2rtc_win64.zip' -OutFile $zip; Expand-Archive -Force $zip '${binDir}' }`,
  ], {stdio: 'inherit'});
  spawn(exe, ['-config', config], {cwd: binDir, detached: true, stdio: 'ignore'}).unref();
} else {
  runPnpm(['go2rtc:up']);
}

if (!existsSync(path.join(webRoot, 'index.html'))) {
  console.log('Building the panel…');
  runPnpm(['web:build']);
}

const server = createServer((request, response) => {
  const pathName = (request.url ?? '/').split('?')[0];
  if (pathName === '/api/discover') {
    handleDiscover(request, response);
    return;
  }
  const file = fileFor(request.url ?? '/');
  if (!file) {
    response.writeHead(404);
    response.end('File not found');
    return;
  }
  response.writeHead(200, {'content-type': types[path.extname(file)] ?? 'application/octet-stream'});
  createReadStream(file).pipe(response);
});

function openPanel(url) {
  if (process.platform === 'darwin') {
    spawn('open', [url], {detached: true, stdio: 'ignore'}).unref();
    return;
  }
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], {detached: true, stdio: 'ignore', windowsHide: true}).unref();
    return;
  }
  spawn('xdg-open', [url], {detached: true, stdio: 'ignore'}).unref();
}

server.listen(port, '0.0.0.0', () => {
  const localUrl = `http://127.0.0.1:${port}`;
  console.log('');
  console.log(`Panel on this computer:  ${localUrl}`);
  for (const address of lanAddresses()) {
    console.log(`Phone on the same Wi-Fi: http://${address}:${port}`);
  }
  console.log('go2rtc: http://127.0.0.1:1984');
  console.log('');
  console.log('The browser should open by itself. Leave this window open. Closing it stops the panel.');
  console.log('Cameras are added in Settings → Import JSON.');
  openPanel(localUrl);
});
