'use client';

import {deviceOpenUrl, type Device, type NetworkSettings} from '@smartosa/core';
import {ExternalLink} from 'lucide-react';
import Link from 'next/link';
import {Card, KindMark} from '@/domains/ui';
import {CameraTile} from './CameraTile';
import styles from './DeviceCard.module.css';

type Props = {
  device: Device;
  settings: NetworkSettings;
};

export function DeviceCard({device, settings}: Props) {
  const openUrl = deviceOpenUrl(device, settings);

  if (device.kind === 'camera') {
    return (
      <CameraTile device={device} openHref={`/devices/view?id=${device.id}`} settings={settings} />
    );
  }

  return (
    <Card>
      <div className={styles.meta}>
        <KindMark kind={device.kind} />
        <Link href={`/devices/edit?id=${device.id}`}>{device.name}</Link>
        {device.room ? <small>{device.room}</small> : null}
      </div>
      {openUrl ? (
        <a className={styles.external} href={openUrl} rel="noreferrer" target="_blank">
          <ExternalLink size={16} />
          Открыть {device.kind === 'iframe' ? 'морду' : 'ссылку'}
        </a>
      ) : null}
    </Card>
  );
}
