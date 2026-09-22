import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {
  isHomeHost,
  keeneticPassword,
  mergeFound,
  parseForwards,
  parseHotspotHosts,
  parseOnvifProbe,
  routerBase,
} from './discover.mjs';

test('keenetic password follows the router challenge', () => {
  const login = 'admin';
  const password = 'secret';
  const realm = 'Keenetic';
  const challenge = 'abc';
  const md5 = createHash('md5').update(`${login}:${realm}:${password}`).digest('hex');
  const expected = createHash('sha256').update(`${challenge}${md5}`).digest('hex');
  assert.equal(keeneticPassword(login, password, realm, challenge), expected);
});

test('router address stays inside the home network', () => {
  assert.equal(routerBase('192.168.1.1'), 'http://192.168.1.1');
  assert.equal(routerBase('http://10.1.1.1:8080'), 'http://10.1.1.1:8080');
  assert.equal(isHomeHost('my.keenetic.net'), true);
  assert.throws(() => routerBase('8.8.8.8'), /домашней сети/);
});

test('hotspot, forwards and onvif answers become one list', () => {
  const hosts = parseHotspotHosts({
    host: [
      {ip: '192.168.1.1', name: 'Keenetic', mac: 'aa', active: true},
      {ip: '192.168.1.50', hostname: 'gate', mac: 'bb', active: true},
      {ip: '192.168.1.40', name: 'phone', mac: 'cc', active: false},
    ],
  });
  const forwards = parseForwards([
    {protocol: 'tcp', port: '13554', 'to-host': '192.168.1.50', 'to-port': '80'},
  ]);
  const cameras = parseOnvifProbe(
    '<d:XAddrs>http://192.168.1.50:80/onvif/device_service</d:XAddrs>',
  );
  const devices = mergeFound({hosts, forwards, cameras, routerIp: '192.168.1.1'});
  assert.deepEqual(devices, [
    {
      ip: '192.168.1.50',
      name: 'gate',
      mac: 'bb',
      active: true,
      camera: true,
      onvifPort: 80,
      forwards: [{protocol: 'tcp', port: 13554, toPort: 80}],
    },
  ]);
});
