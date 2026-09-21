'use client';

import {useAppVisitOnce, useHomeData} from '@/domains/shell';
import {Button, Card, EmptyState, KindMark, PageHeader, type MarkKind} from '@/domains/ui';
import {WallBoard} from '@/domains/wall';
import {popularTargets, type Device, type PopularTarget} from '@smartosa/core';
import {LayoutGrid, Star} from 'lucide-react';
import Link from 'next/link';
import styles from './HomeScreen.module.css';

function popularKind(item: PopularTarget, devices: Device[]): MarkKind {
  if (item.kind === 'wall') {
    return 'wall';
  }
  return devices.find((entry) => entry.id === item.targetId)?.kind ?? 'device';
}

function targetHref(item: PopularTarget, devices: Device[]): string | null {
  if (item.kind === 'wall') {
    return `/wall/view?id=${item.targetId}`;
  }
  const device = devices.find((entry) => entry.id === item.targetId);
  if (!device) {
    return null;
  }
  return device.kind === 'camera' ? `/devices/view?id=${device.id}` : `/devices/edit?id=${device.id}`;
}

function timesLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return `${count} раз`;
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} раза`;
  }
  return `${count} раз`;
}

export function HomeScreen() {
  const {ready, devices, walls, visits, settings} = useHomeData();
  useAppVisitOnce();
  const popular = popularTargets(
    visits.filter((visit) => {
      if (visit.kind === 'device') {
        return devices.some((device) => device.id === visit.targetId);
      }
      if (visit.kind === 'wall') {
        return walls.some((wall) => wall.id === visit.targetId);
      }
      return false;
    }),
  );
  const pinned = walls.filter((wall) => wall.onDashboard);

  return (
    <div>
      <PageHeader
        actions={<Button href="/wall/edit">Добавить</Button>}
        description="Камеры и стены, куда заходите чаще всего."
        title="Дом"
      />
      {!ready ? <p>Загрузка…</p> : null}
      <Card className={styles.popular}>
        <h2><Star size={18} /> Популярное</h2>
        {popular.length === 0 ? (
          <EmptyState
            description="Откройте камеру или стену — здесь останутся те, куда заходите чаще всего."
            title="Пока пусто"
          />
        ) : (
          <ol className={styles.visits}>
            {popular.map((item) => {
              const href = targetHref(item, devices);
              const kind = popularKind(item, devices);
              const body = (
                <>
                  <KindMark kind={kind} label={false} />
                  <span className={styles.popularText}>
                    <strong>{item.title}</strong>
                  </span>
                  <span className={styles.count}>{timesLabel(item.count)}</span>
                </>
              );
              return (
                <li key={`${item.kind}:${item.targetId}`}>
                  {href ? (
                    <Link className={styles.visit} href={href}>
                      {body}
                    </Link>
                  ) : (
                    <div className={styles.visit}>{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>
      {pinned.map((wall) => (
        <section className={styles.section} key={wall.id}>
          <div className={styles.sectionHead}>
            <h2><LayoutGrid size={18} /> {wall.name}</h2>
            <div>
              <Button href={`/wall/view?id=${wall.id}`} variant="ghost">
                Открыть
              </Button>
              <Button href={`/wall/edit?id=${wall.id}`} variant="ghost">
                Настроить
              </Button>
            </div>
          </div>
          <WallBoard
            devices={devices}
            settings={settings}
            wall={{...wall, layout: wall.dashboardLayout ?? wall.layout}}
          />
        </section>
      ))}
    </div>
  );
}
