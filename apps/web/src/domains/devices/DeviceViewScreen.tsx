'use client';

import {useHomeData, useTargetVisit} from '@/domains/shell';
import {Button, PageHeader} from '@/domains/ui';
import {cameraStreamName, cameraWebUrls} from '@smartosa/core';
import {Maximize, Minimize, Settings} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import {CameraTile} from './CameraTile';
import styles from './DeviceViewScreen.module.css';

export function DeviceViewScreen() {
  const params = useSearchParams();
  const id = params.get('id');
  const {ready, devices, settings} = useHomeData();
  const device = devices.find((item) => item.id === id && item.kind === 'camera') ?? null;

  useTargetVisit('device', device?.id ?? null, device?.name ?? null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [mainLive, setMainLive] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    setMainLive(false);
  }, [device?.id]);

  if (!ready) {
    return <p>Загрузка…</p>;
  }
  if (!device || device.kind !== 'camera') {
    return <p>Камера не найдена</p>;
  }

  const webUrls = cameraWebUrls(device, settings);

  async function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await frame.requestFullscreen();
  }

  return (
    <div className={styles.page}>
      <PageHeader
        actions={
          <>
            <Button
              aria-label="Настроить"
              className={styles.iconButton}
              href={`/devices/edit?id=${device.id}`}
              title="Настроить"
              variant="ghost"
            >
              <Settings size={18} />
            </Button>
            {webUrls.map((item) => (
              <Button href={item.href} key={item.href} rel="noreferrer" target="_blank" variant="ghost">
                {item.label}
              </Button>
            ))}
          </>
        }
        description={`Поток ${cameraStreamName(device, 'main')}`}
        title={device.name}
      />
      <div className={styles.frame} ref={frameRef}>
        <div className={styles.video}>
          <CameraTile
            device={device}
            fill
            key={device.id}
            onMainLive={() => setMainLive(true)}
            settings={settings}
            streamRole="main"
          />
          {mainLive ? null : (
            <div className={styles.side}>
              <span className={styles.spinner} />
              <span>Основной поток</span>
            </div>
          )}
          <button className={styles.fullscreen} onClick={() => void toggleFullscreen()} type="button">
            {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            {fullscreen ? 'Свернуть' : 'Во весь экран'}
          </button>
        </div>
      </div>
    </div>
  );
}
