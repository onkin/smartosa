import {createHash, randomUUID} from 'node:crypto';
import {createSocket} from 'node:dgram';
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';

const MULTICAST = '239.255.255.250';
const DISCOVERY_PORT = 3702;
const BODY_LIMIT = 8192;

export function keeneticPassword(login, password, realm, challenge) {
  const md5 = createHash('md5').update(`${login}:${realm}:${password}`).digest('hex');
  return createHash('sha256').update(`${challenge}${md5}`).digest('hex');
}

export function routerBase(host) {
  const trimmed = String(host ?? '').trim();
  if (!trimmed) {
    throw new Error('Укажите адрес роутера.');
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error('Адрес роутера не разбирается.');
  }
  if (!isHomeHost(url.hostname)) {
    throw new Error('Адрес роутера должен быть в домашней сети.');
  }
  return url.origin;
}

export function isHomeHost(hostname) {
  const host = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.keenetic.net') || host === 'keenetic.net') {
    return true;
  }
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export function parseHotspotHosts(payload) {
  const list = Array.isArray(payload?.host) ? payload.host : Array.isArray(payload) ? payload : [];
  const hosts = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const ip = text(item.ip);
    if (!ip || !isHomeHost(ip)) {
      continue;
    }
    const name = text(item.name) || text(item.hostname) || ip;
    hosts.push({
      ip,
      name,
      mac: text(item.mac),
      active: item.active === true,
    });
  }
  return hosts;
}

export function parseForwards(payload) {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rule)
      ? payload.rule
      : Array.isArray(payload?.static)
        ? payload.static
        : Array.isArray(payload?.nat)
          ? payload.nat
          : [];
  const forwards = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const ip = text(item['to-host'] ?? item.to_host ?? item.toHost ?? item.host);
    const port = number(item.port);
    if (!ip || !isHomeHost(ip) || !port) {
      continue;
    }
    const toPort = number(item['to-port'] ?? item.to_port ?? item.toPort);
    forwards.push({
      ip,
      protocol: text(item.protocol) || 'tcp',
      port,
      ...(toPort ? {toPort} : {}),
    });
  }
  return forwards;
}

export function parseOnvifProbe(xml) {
  const found = [];
  const pattern = /XAddrs[^>]*>\s*([^<]+)/gi;
  let match = pattern.exec(xml);
  while (match) {
    for (const part of match[1].split(/\s+/)) {
      try {
        const url = new URL(part);
        if (!isHomeHost(url.hostname)) {
          continue;
        }
        const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
        found.push({ip: url.hostname, port});
      } catch {
        continue;
      }
    }
    match = pattern.exec(xml);
  }
  return found;
}

export function mergeFound({hosts, forwards, cameras, routerIp}) {
  const byIp = new Map();
  for (const host of hosts) {
    if (host.ip === routerIp) {
      continue;
    }
    byIp.set(host.ip, {
      ip: host.ip,
      name: host.name,
      mac: host.mac,
      active: host.active,
      camera: false,
      forwards: [],
    });
  }
  for (const forward of forwards) {
    const current = byIp.get(forward.ip) ?? {
      ip: forward.ip,
      name: forward.ip,
      mac: '',
      active: false,
      camera: false,
      forwards: [],
    };
    current.forwards.push({
      protocol: forward.protocol,
      port: forward.port,
      ...(forward.toPort ? {toPort: forward.toPort} : {}),
    });
    byIp.set(forward.ip, current);
  }
  for (const camera of cameras) {
    const current = byIp.get(camera.ip) ?? {
      ip: camera.ip,
      name: camera.ip,
      mac: '',
      active: true,
      camera: false,
      forwards: [],
    };
    current.camera = true;
    current.onvifPort = camera.port;
    byIp.set(camera.ip, current);
  }
  return [...byIp.values()]
    .filter((item) => item.active || item.forwards.length > 0 || item.camera)
    .sort((left, right) => Number(right.active) - Number(left.active) || left.ip.localeCompare(right.ip, 'en'));
}

export async function discoverNetwork({routerHost, user, password, probeMs = 1200}) {
  const base = routerBase(routerHost);
  const routerIp = new URL(base).hostname;
  const [listed, cameras] = await Promise.all([
    readKeenetic(base, user, password),
    probeOnvif(probeMs).catch(() => []),
  ]);
  return {
    devices: mergeFound({
      hosts: listed.hosts,
      forwards: listed.forwards,
      cameras,
      routerIp,
    }),
  };
}

export function handleDiscover(request, response) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method !== 'POST') {
    response.writeHead(405, {'content-type': 'application/json; charset=utf-8'});
    response.end(JSON.stringify({error: 'Нужен POST'}));
    return;
  }
  readBody(request)
    .then(async (raw) => {
      const body = JSON.parse(raw || '{}');
      const result = await discoverNetwork({
        routerHost: body.routerHost,
        user: body.user,
        password: body.password,
      });
      sendJson(response, 200, result);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Не удалось опросить роутер';
      sendJson(response, 400, {error: message});
    });
}

export function listenDiscover(port = 4310) {
  const server = createServer((request, response) => {
    const pathName = (request.url ?? '/').split('?')[0];
    if (pathName !== '/api/discover') {
      response.writeHead(404);
      response.end();
      return;
    }
    handleDiscover(request, response);
  });
  server.on('error', (error) => {
    const message = error instanceof Error ? error.message : 'Порт поиска занят';
    console.error(message.includes('EADDRINUSE') || error?.code === 'EADDRINUSE'
      ? 'Порт 4310 уже занят, поиск в сети может не открыться.'
      : message);
  });
  server.listen(port, '127.0.0.1');
  return server;
}

async function readKeenetic(base, user, password) {
  if (!String(user ?? '').trim() || !String(password ?? '')) {
    throw new Error('Нужны логин и пароль Keenetic.');
  }
  const cookie = await login(base, String(user).trim(), String(password));
  const [hotspot, hotspotHost, natPayload, staticPayload] = await Promise.all([
    rciGet(base, cookie, '/rci/show/ip/hotspot').catch(() => null),
    rciGet(base, cookie, '/rci/show/ip/hotspot/host').catch(() => null),
    rciGet(base, cookie, '/rci/show/ip/nat').catch(() => null),
    rciGet(base, cookie, '/rci/show/ip/static').catch(() => null),
  ]);
  let hosts = [...parseHotspotHosts(hotspot), ...parseHotspotHosts(hotspotHost)];
  const forwards = [];
  collectForwards(natPayload, forwards);
  collectForwards(staticPayload, forwards);
  if (hosts.length === 0) {
    const posted = await rciPost(base, cookie, {show: {ip: {hotspot: {}}}}).catch(() => null);
    hosts = collectHosts(posted);
    collectForwards(posted, forwards);
  }
  return {hosts: uniqueHosts(hosts), forwards: uniqueForwards(forwards)};
}

function uniqueForwards(forwards) {
  const seen = new Set();
  return forwards.filter((item) => {
    const key = `${item.ip}|${item.protocol}|${item.port}|${item.toPort ?? ''}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueHosts(hosts) {
  const byIp = new Map();
  for (const host of hosts) {
    byIp.set(host.ip, host);
  }
  return [...byIp.values()];
}

function collectHosts(value) {
  if (!value || typeof value !== 'object') {
    return [];
  }
  const direct = parseHotspotHosts(value);
  if (direct.length > 0) {
    return direct;
  }
  const nested = Array.isArray(value) ? value : Object.values(value);
  return nested.flatMap((item) => collectHosts(item));
}

function collectForwards(value, into) {
  if (!value || typeof value !== 'object') {
    return;
  }
  const direct = parseForwards(value);
  if (direct.length > 0) {
    into.push(...direct);
    return;
  }
  const nested = Array.isArray(value) ? value : Object.values(value);
  for (const item of nested) {
    collectForwards(item, into);
  }
}

async function rciPost(base, cookie, command) {
  const response = await fetch(`${base}/rci/`, {
    method: 'POST',
    redirect: 'manual',
    headers: {cookie, 'content-type': 'application/json'},
    body: JSON.stringify([command]),
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) {
    throw new Error(`Keenetic не отдал список (${response.status}).`);
  }
  return response.json();
}

async function login(base, user, password) {
  const first = await fetch(`${base}/auth`, {redirect: 'manual', signal: AbortSignal.timeout(6000)});
  const realm = first.headers.get('x-ndm-realm');
  const challenge = first.headers.get('x-ndm-challenge');
  if (!realm || !challenge) {
    throw new Error('Роутер не ответил как Keenetic. Укажите его домашний IP.');
  }
  const second = await fetch(`${base}/auth`, {
    method: 'POST',
    redirect: 'manual',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({login: user, password: keeneticPassword(user, password, realm, challenge)}),
    signal: AbortSignal.timeout(6000),
  });
  if (second.status === 401 || second.status === 403) {
    throw new Error('Keenetic не принял логин или пароль.');
  }
  if (!second.ok) {
    throw new Error(`Keenetic ответил ${second.status}.`);
  }
  const cookie = cookieHeader(second);
  if (!cookie) {
    throw new Error('Keenetic не открыл сессию.');
  }
  return cookie;
}

async function rciGet(base, cookie, path) {
  const response = await fetch(`${base}${path}`, {
    headers: {cookie},
    redirect: 'manual',
    signal: AbortSignal.timeout(6000),
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Keenetic не отдал список (${response.status}).`);
  }
  return response.json();
}

function probeOnvif(timeoutMs) {
  const message = Buffer.from(onvifProbe());
  return new Promise((resolve) => {
    const socket = createSocket({type: 'udp4', reuseAddr: true});
    const found = [];
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      socket.close();
      resolve(found);
    };
    socket.on('error', finish);
    socket.on('message', (packet) => {
      found.push(...parseOnvifProbe(packet.toString('utf8')));
    });
    socket.bind(0, () => {
      const addresses = localAddresses();
      for (const address of addresses) {
        try {
          socket.addMembership(MULTICAST, address);
        } catch {
          continue;
        }
        socket.send(message, DISCOVERY_PORT, MULTICAST);
      }
      if (addresses.length === 0) {
        socket.send(message, DISCOVERY_PORT, MULTICAST);
      }
    });
    setTimeout(finish, timeoutMs);
  });
}

function onvifProbe() {
  const id = randomUUID();
  return `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:a="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery" xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <s:Header>
    <a:Action s:mustUnderstand="1">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</a:Action>
    <a:MessageID>uuid:${id}</a:MessageID>
    <a:ReplyTo><a:Address>http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous</a:Address></a:ReplyTo>
    <a:To s:mustUnderstand="1">urn:schemas-xmlsoap-org:ws:2005:04:discovery</a:To>
  </s:Header>
  <s:Body>
    <d:Probe><d:Types>dn:NetworkVideoTransmitter</d:Types></d:Probe>
  </s:Body>
</s:Envelope>`;
}

function localAddresses() {
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

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error('Слишком большой запрос.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

function cookieHeader(response) {
  const lines = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  const pairs = lines.map((line) => line.split(';')[0]).filter(Boolean);
  if (pairs.length > 0) {
    return pairs.join('; ');
  }
  const raw = response.headers.get('set-cookie');
  return raw ? raw.split(';')[0] : '';
}

function sendJson(response, status, payload) {
  response.writeHead(status, {'content-type': 'application/json; charset=utf-8'});
  response.end(JSON.stringify(payload));
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function number(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 0;
}
