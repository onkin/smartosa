'use client';

import {useHomeData, useTargetVisit} from '@/domains/shell';
import {Button, PageHeader} from '@/domains/ui';
import {useSearchParams} from 'next/navigation';
import {WallBoard} from './WallBoard';
import styles from './WallViewScreen.module.css';

export function WallViewScreen() {
  const params = useSearchParams();
  const id = params.get('id');
  const {ready, walls, devices, settings} = useHomeData();
  const wall = walls.find((item) => item.id === id) ?? null;

  useTargetVisit('wall', wall?.id ?? null, wall?.name ?? null);

  if (!ready) {
    return <p>Загрузка…</p>;
  }
  if (!wall) {
    return <p>Стена не найдена</p>;
  }

  return (
    <div className={styles.page}>
      <PageHeader
        actions={<Button href={`/wall/edit?id=${wall.id}`} variant="ghost">Настроить</Button>}
        title={wall.name}
      />
      <WallBoard devices={devices} settings={settings} wall={wall} />
    </div>
  );
}
