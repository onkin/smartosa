import {cp, mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'apps', 'web', 'out');
const to = path.join(root, 'dist', 'apps', 'web');

await rm(to, {recursive: true, force: true});
await mkdir(to, {recursive: true});
await cp(from, to, {recursive: true});
