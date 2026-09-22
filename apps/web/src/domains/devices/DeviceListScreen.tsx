'use client';

import {useHomeData} from '@/domains/shell';
import {Button, EmptyState, KindMark, PageHeader} from '@/domains/ui';
import type {DeviceKind} from '@smartosa/core';
import {DeviceCard} from './DeviceCard';
import styles from './DeviceListScreen.module.css';

const KINDS: DeviceKind[] = ['camera', 'iframe', 'link'];

export function DeviceListScreen() {
  const {ready, devices, settings} = useHomeData();

  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button href="/devices/discover" variant="ghost">
              Найти в сети
            </Button>
            <Button href="/devices/edit?kind=camera">
              <KindMark kind="camera" label={false} /> Камера
            </Button>
            <Button href="/devices/edit?kind=iframe" variant="ghost">
              <KindMark kind="iframe" label={false} /> Морда
            </Button>
            <Button href="/devices/edit?kind=link" variant="ghost">
              <KindMark kind="link" label={false} /> Ссылка
            </Button>
          </>
        }
        description="Камеры, веб-морды аккумуляторов и котлов, запасные ссылки."
        title="Устройства"
      />
      {!ready ? <p>Загрузка…</p> : null}
      {ready && devices.length === 0 ? (
        <EmptyState
          action={<Button href="/devices/edit?kind=camera">Добавить камеру</Button>}
          description="Пока ничего нет — начните с камеры или iframe устройства."
          title="Список пуст"
        />
      ) : null}
      {KINDS.map((kind) => {
        const items = devices.filter((device) => device.kind === kind);
        if (items.length === 0) {
          return null;
        }
        return (
          <section className={styles.group} key={kind}>
            <h2>
              <KindMark kind={kind} label={false} />
              {kind === 'camera' ? 'Камеры' : kind === 'iframe' ? 'Веб-морды' : 'Ссылки'}
            </h2>
            <div className={styles.grid}>
              {items.map((device) => (
                <DeviceCard device={device} key={device.id} settings={settings} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
