'use client';

import {WALL_LAYOUT_LABEL} from '@/domains/devices';
import {useHomeData} from '@/domains/shell';
import {Button, Card, Field, PageHeader, Select, TextInput} from '@/domains/ui';
import {createId, type CameraWall, type WallLayout} from '@smartosa/core';
import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useMemo, useState, type FormEvent} from 'react';
import {WallOrderList} from './WallOrderList';
import styles from './WallEditScreen.module.css';

const LAYOUTS: WallLayout[] = ['2x2', '1+3', 'custom'];

function emptyWall(now: number): CameraWall {
  return {
    id: createId(),
    name: 'Двор',
    layout: '2x2',
    deviceIds: [],
    onDashboard: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function WallEditScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const {ready, walls, devices, repo, reload} = useHomeData();
  const id = params.get('id');
  const existing = useMemo(() => walls.find((wall) => wall.id === id) ?? null, [id, walls]);
  const [draft, setDraft] = useState<CameraWall | null>(null);

  useEffect(() => {
    if (!ready || draft) {
      return;
    }
    setDraft(existing ?? emptyWall(Date.now()));
  }, [draft, existing, ready]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !draft.name.trim()) {
      return;
    }
    const saved = {...draft, name: draft.name.trim(), updatedAt: Date.now()};
    await repo.upsertWall(saved);
    await reload();
    router.push(`/wall/view?id=${saved.id}`);
  }

  async function onDelete() {
    if (!draft || !existing) {
      return;
    }
    if (!window.confirm(`Удалить стену «${draft.name}»?`)) {
      return;
    }
    await repo.deleteWall(draft.id);
    await reload();
    router.push('/wall');
  }

  if (!ready || !draft) {
    return <p>Загрузка…</p>;
  }

  return (
    <div>
      <PageHeader title={existing ? `Стена: ${draft.name}` : 'Новая стена'} />
      <Card>
        <form className={styles.form} onSubmit={onSubmit}>
          <Field hint="Как стена называется в списке и на дашборде" label="Название">
            <TextInput
              onChange={(event) => setDraft({...draft, name: event.target.value})}
              placeholder="Камеры"
              required
              value={draft.name}
            />
          </Field>
          <Field
            hint="2×2 — две колонки. Одна большая — первая плитка крупная, остальные под ней, клик по маленькой делает её крупной. По ширине — равные плитки, колонок столько, сколько влезает."
            label="Сетка"
          >
            <Select
              onChange={(event) => setDraft({...draft, layout: event.target.value as WallLayout})}
              value={draft.layout}
            >
              {LAYOUTS.map((layout) => (
                <option key={layout} value={layout}>
                  {WALL_LAYOUT_LABEL[layout]}
                </option>
              ))}
            </Select>
          </Field>
          <div className={styles.dashboard}>
            <label className={styles.pin}>
              <input
                checked={draft.onDashboard}
                onChange={(event) => {
                  const onDashboard = event.target.checked;
                  setDraft({
                    ...draft,
                    onDashboard,
                    dashboardLayout: onDashboard ? draft.dashboardLayout ?? draft.layout : draft.dashboardLayout,
                  });
                }}
                type="checkbox"
              />
              <span>
                <strong>Показывать на дашборде</strong>
                <small>Стена появится на главной. Сетку для главной можно выбрать отдельно.</small>
              </span>
            </label>
            {draft.onDashboard ? (
              <Field hint="Как разложить плитки этой стены на главной." label="Сетка на дашборде">
                <Select
                  onChange={(event) =>
                    setDraft({...draft, dashboardLayout: event.target.value as WallLayout})
                  }
                  value={draft.dashboardLayout ?? draft.layout}
                >
                  {LAYOUTS.map((layout) => (
                    <option key={layout} value={layout}>
                      {WALL_LAYOUT_LABEL[layout]}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <WallOrderList
            devices={devices}
            ids={draft.deviceIds}
            onChange={(deviceIds) => setDraft({...draft, deviceIds})}
          />
          <div className={styles.actions}>
            <Button type="submit">Сохранить</Button>
            {existing ? (
              <Button onClick={onDelete} variant="danger">
                Удалить
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
