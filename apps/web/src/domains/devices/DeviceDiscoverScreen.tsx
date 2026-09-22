'use client';

import {useHomeData} from '@/domains/shell';
import {Button, Card, Field, PageHeader, TextInput} from '@/domains/ui';
import {createId, type Device} from '@smartosa/core';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import styles from './DeviceDiscoverScreen.module.css';

type Forward = {
  protocol: string;
  port: number;
  toPort?: number;
};

type FoundDevice = {
  ip: string;
  name: string;
  mac: string;
  active: boolean;
  camera: boolean;
  onvifPort?: number;
  forwards: Forward[];
};

function mentionsIp(value: string, ip: string): boolean {
  return value.split(/[^0-9.]+/).includes(ip);
}

function alreadyAdded(devices: Device[], ip: string): boolean {
  return devices.some((device) => {
    const blob = device.kind === 'camera'
      ? [device.onvifHost, device.iframeUrl, device.snapshotUrl, device.rtspUrl, device.mainRtspUrl].filter(Boolean).join(' ')
      : device.url;
    return mentionsIp(blob, ip);
  });
}

function toDevice(item: FoundDevice, now: number): Device {
  const base = {id: createId(), name: item.name || item.ip, createdAt: now, updatedAt: now};
  const httpForward = item.forwards.find((forward) => forward.protocol === 'tcp' && forward.toPort === 80)
    ?? item.forwards.find((forward) => forward.protocol === 'tcp');
  if (item.camera) {
    return {
      ...base,
      kind: 'camera',
      viewMode: 'snapshot',
      rtspUrl: '',
      go2rtcName: `lan-${item.ip.replace(/\./g, '-')}`,
      mainRtspUrl: '',
      mainGo2rtcName: '',
      aspect: 'native',
      snapshotUrl: '',
      mjpegUrl: '',
      iframeUrl: `http://${item.ip}/`,
      onvifHost: httpForward ? '{wan}' : item.ip,
      onvifPort: httpForward?.port ?? item.onvifPort ?? 80,
    };
  }
  return {...base, kind: 'link', url: `http://${item.ip}/`};
}

function forwardLabel(forward: Forward): string {
  const target = forward.toPort ? ` → ${forward.toPort}` : '';
  return `${forward.protocol.toUpperCase()} ${forward.port}${target}`;
}

export function DeviceDiscoverScreen() {
  const {ready, devices, settings, repo, reload} = useHomeData();
  const router = useRouter();
  const [routerHost, setRouterHost] = useState(settings.routerHost || settings.lanHost || '');
  const [user, setUser] = useState(settings.routerUser || 'admin');
  const [password, setPassword] = useState(settings.routerPassword || '');
  const [remember, setRemember] = useState(Boolean(settings.routerPassword));
  const [found, setFound] = useState<FoundDevice[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    if (!ready || filled) {
      return;
    }
    setRouterHost(settings.routerHost || settings.lanHost || '');
    setUser(settings.routerUser || 'admin');
    setPassword(settings.routerPassword || '');
    setRemember(Boolean(settings.routerPassword));
    setFilled(true);
  }, [filled, ready, settings]);

  async function onSearch() {
    if (!routerHost.trim() || !user.trim() || !password) {
      setMessage('Нужны адрес роутера, логин и пароль.');
      return;
    }
    setPending(true);
    setMessage('');
    setFound([]);
    setPicked([]);
    try {
      await repo.setSettings({
        lanHost: settings.lanHost,
        wanHost: settings.wanHost,
        go2rtcUrl: settings.go2rtcUrl,
        ...(settings.watchFrames ? {watchFrames: true} : {}),
        routerHost: routerHost.trim(),
        ...(remember ? {routerUser: user.trim(), routerPassword: password} : {}),
      });
      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({routerHost: routerHost.trim(), user: user.trim(), password}),
      });
      let payload: {devices?: FoundDevice[]; error?: string};
      try {
        payload = (await response.json()) as {devices?: FoundDevice[]; error?: string};
      } catch {
        throw new Error('Поиск открывается на компьютере в доме. Запустите панель здесь и обновите страницу.');
      }
      if (!response.ok) {
        throw new Error(payload.error || 'Роутер не ответил');
      }
      const devicesFound = payload.devices ?? [];
      setFound(devicesFound);
      setMessage(devicesFound.length === 0 ? 'Keenetic не показал устройств с адресом.' : '');
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Не удалось спросить роутер';
      setMessage(
        text === 'Failed to fetch'
          ? 'Поиск открывается на компьютере в доме. Запустите панель здесь и обновите страницу.'
          : text,
      );
    } finally {
      setPending(false);
      await reload();
    }
  }

  async function onAdd() {
    const chosen = found.filter((item) => picked.includes(item.ip) && !alreadyAdded(devices, item.ip));
    if (chosen.length === 0) {
      return;
    }
    const now = Date.now();
    for (const item of chosen) {
      await repo.upsertDevice(toDevice(item, now));
    }
    await reload();
    router.push('/devices');
  }

  return (
    <div>
      <PageHeader
        description="Список берётся у Keenetic в домашней сети: IP и проброшенный порт белого IP. Логин камеры так не находится. С телефона из интернета поиск не сработает."
        title="Найти в сети"
      />
      <Card>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault();
            void onSearch();
          }}
        >
          <Field hint="Обычно 192.168.1.1" label="Адрес роутера">
            <TextInput
              onChange={(event) => setRouterHost(event.target.value)}
              placeholder="192.168.1.1"
              value={routerHost}
            />
          </Field>
          <Field label="Логин">
            <TextInput onChange={(event) => setUser(event.target.value)} value={user} />
          </Field>
          <Field label="Пароль">
            <TextInput
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </Field>
          <label className={styles.pin}>
            <input checked={remember} onChange={(event) => setRemember(event.target.checked)} type="checkbox" />
            <span>Запомнить в этом браузере. В файл резервной копии пароль не попадает.</span>
          </label>
          <div className={styles.row}>
            <Button disabled={pending} type="submit">
              {pending ? 'Ищем…' : 'Найти'}
            </Button>
          </div>
        </form>
      </Card>
      {message ? <p className={styles.message}>{message}</p> : null}
      {found.length > 0 ? (
        <section className={styles.results}>
          <ul className={styles.list}>
            {found.map((item) => {
              const saved = alreadyAdded(devices, item.ip);
              return (
                <li key={item.ip}>
                  <label className={styles.device}>
                    <input
                      checked={picked.includes(item.ip)}
                      disabled={saved}
                      onChange={(event) => {
                        setPicked((current) =>
                          event.target.checked ? [...current, item.ip] : current.filter((ip) => ip !== item.ip),
                        );
                      }}
                      type="checkbox"
                    />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.ip}
                        {item.camera ? ' · камера' : ''}
                        {item.active ? '' : ' · сейчас не в сети'}
                        {saved ? ' · уже в доме' : ''}
                        {item.forwards.length > 0 ? ` · белый порт ${item.forwards.map(forwardLabel).join(', ')}` : ''}
                      </small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <Button disabled={picked.length === 0} onClick={() => void onAdd()} type="button">
            Добавить выбранные
          </Button>
        </section>
      ) : null}
    </div>
  );
}
