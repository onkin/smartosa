'use client';

import {WALL_LAYOUT_LABEL} from '@/domains/devices';
import {useHomeData} from '@/domains/shell';
import {Button, EmptyState, KindMark, PageHeader} from '@/domains/ui';
import {Settings} from 'lucide-react';
import Link from 'next/link';
import styles from './WallListScreen.module.css';

export function WallListScreen() {
  const {ready, walls} = useHomeData();

  return (
    <div>
      <PageHeader
        actions={<Button href="/wall/edit">Новая стена</Button>}
        description="Камеры и другие устройства на одном экране. Раскладку можно вынести на главную."
        title="Стены"
      />
      {!ready ? <p>Загрузка…</p> : null}
      {ready && walls.length === 0 ? (
        <EmptyState
          action={<Button href="/wall/edit">Собрать стену</Button>}
          description="Добавьте устройства, расставьте их перетаскиванием и выберите сетку."
          title="Стен нет"
        />
      ) : null}
      <div className={styles.grid}>
        {walls.map((wall) => (
          <article className={styles.tile} key={wall.id}>
            <Link className={styles.open} href={`/wall/view?id=${wall.id}`}>
              <h2>
                <KindMark kind="wall" label={false} />
                {wall.name}
              </h2>
              <p>
                {WALL_LAYOUT_LABEL[wall.layout]} · {wall.deviceIds.length} шт.
                {wall.onDashboard ? ' · на дашборде' : ''}
              </p>
            </Link>
            <Link
              aria-label={`Настроить ${wall.name}`}
              className={styles.settings}
              href={`/wall/edit?id=${wall.id}`}
              title="Настроить"
            >
              <Settings size={16} />
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
