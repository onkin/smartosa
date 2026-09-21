'use client';

import {CameraTile} from '@/domains/devices';
import {EmbedFrame, KindMark} from '@/domains/ui';
import {deviceOpenUrl, type CameraWall, type Device, type NetworkSettings} from '@smartosa/core';
import {Settings} from 'lucide-react';
import Link from 'next/link';
import {useState} from 'react';
import styles from './WallBoard.module.css';
import layoutStyles from './WallViewScreen.module.css';

type Props = {
  devices: Device[];
  settings: NetworkSettings;
  wall: CameraWall;
};

function WallTile({
  device,
  settings,
  onActivate,
}: {
  device: Device;
  settings: NetworkSettings;
  onActivate?: () => void;
}) {
  if (device.kind === 'camera') {
    return (
      <CameraTile
        device={device}
        onActivate={onActivate}
        openHref={onActivate ? undefined : `/devices/view?id=${device.id}`}
        settings={settings}
      />
    );
  }
  return <DeviceTile device={device} onActivate={onActivate} settings={settings} />;
}

export function WallBoard({devices, settings, wall}: Props) {
  const items = wall.deviceIds
    .map((id) => devices.find((device) => device.id === id) ?? null)
    .filter((device): device is Device => device !== null);
  const layout = wall.layout === '1+3' ? 'plus' : wall.layout === '2x2' ? 'grid2' : 'custom';
  const [pick, setPick] = useState<{wallId: string; heroId: string} | null>(null);

  if (items.length === 0) {
    return <p className={styles.empty}>На стене пока ничего нет.</p>;
  }

  if (layout === 'plus' && items.length > 1) {
    const hero = items.find((device) => device.id === pick?.heroId && pick.wallId === wall.id) ?? items[0];
    const rest = items.filter((device) => device.id !== hero.id);
    return (
      <div className={layoutStyles.plus}>
        <WallTile device={hero} key={hero.id} settings={settings} />
        <div className={layoutStyles.stack}>
          {rest.map((device) => (
            <WallTile
              device={device}
              key={device.id}
              onActivate={() => setPick({wallId: wall.id, heroId: device.id})}
              settings={settings}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={layoutStyles[layout]}>
      {items.map((device) => (
        <WallTile device={device} key={device.id} settings={settings} />
      ))}
    </div>
  );
}

function DeviceTile({
  device,
  settings,
  onActivate,
}: {
  device: Device;
  settings: NetworkSettings;
  onActivate?: () => void;
}) {
  const openUrl = device.kind === 'camera' ? null : deviceOpenUrl(device, settings);
  return (
    <article className={styles.tile}>
      <div className={styles.stage}>
        {device.kind === 'iframe' && openUrl ? (
          <EmbedFrame allow="fullscreen" src={openUrl} title={device.name} />
        ) : openUrl ? (
          <a className={styles.open} href={openUrl} rel="noreferrer" target="_blank">
            Открыть ссылку
          </a>
        ) : (
          <p>Нет адреса</p>
        )}
        {onActivate ? (
          <button
            aria-label={`Показать ${device.name} крупно`}
            className={styles.promote}
            onClick={onActivate}
            type="button"
          />
        ) : null}
      </div>
      <footer className={styles.footer}>
        <div className={styles.caption}>
          <KindMark kind={device.kind} label={false} />
          <strong>{device.name}</strong>
          {device.room ? <span className={styles.room}>{device.room}</span> : null}
        </div>
        <Link aria-label={`Настроить ${device.name}`} href={`/devices/edit?id=${device.id}`} title="Настроить">
          <Settings size={16} />
        </Link>
      </footer>
    </article>
  );
}
