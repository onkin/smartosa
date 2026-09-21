'use client';

import type {Device} from '@smartosa/core';
import {GripVertical, X} from 'lucide-react';
import {useRef, useState} from 'react';
import {KindMark} from '@/domains/ui';
import styles from './WallOrderList.module.css';

type Props = {
  devices: Device[];
  ids: string[];
  onChange: (ids: string[]) => void;
};

export function WallOrderList({devices, ids, onChange}: Props) {
  const listRef = useRef<HTMLUListElement>(null);
  const dragRef = useRef<{id: string; pointerId: number} | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const ordered = ids
    .map((id) => devices.find((device) => device.id === id) ?? null)
    .filter((device): device is Device => device !== null);
  const available = devices.filter((device) => !ids.includes(device.id));

  function move(id: string, clientY: number) {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-id]') ?? [];
    const over = [...rows].find((row) => {
      const box = row.getBoundingClientRect();
      return clientY >= box.top && clientY <= box.bottom;
    });
    const overId = over?.dataset.id;
    if (!over || !overId || overId === id) {
      return;
    }
    const next = ids.filter((item) => devices.some((device) => device.id === item));
    const from = next.indexOf(id);
    const to = next.indexOf(overId);
    if (from < 0 || to < 0) {
      return;
    }
    const box = over.getBoundingClientRect();
    const midpoint = box.top + box.height / 2;
    if ((to > from && clientY < midpoint) || (to < from && clientY > midpoint)) {
      return;
    }
    next.splice(from, 1);
    next.splice(to, 0, id);
    onChange(next);
  }

  return (
    <div className={styles.wrap}>
      <div>
        <h3>На стене</h3>
        {ordered.length === 0 ? <p>Добавьте устройство снизу, затем перетащите, чтобы поменять порядок.</p> : null}
        <ul className={styles.order} ref={listRef}>
          {ordered.map((device) => (
            <li className={draggingId === device.id ? styles.dragging : undefined} data-id={device.id} key={device.id}>
              <button
                aria-label={`Перетащить ${device.name}`}
                className={styles.handle}
                onPointerCancel={() => {
                  dragRef.current = null;
                  setDraggingId(null);
                }}
                onPointerDown={(event) => {
                  if (event.button !== 0) {
                    return;
                  }
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragRef.current = {id: device.id, pointerId: event.pointerId};
                  setDraggingId(device.id);
                }}
                onPointerMove={(event) => {
                  const drag = dragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) {
                    return;
                  }
                  move(drag.id, event.clientY);
                }}
                onPointerUp={(event) => {
                  if (dragRef.current?.pointerId !== event.pointerId) {
                    return;
                  }
                  dragRef.current = null;
                  setDraggingId(null);
                }}
                type="button"
              >
                <GripVertical size={16} />
              </button>
              <span className={styles.meta}>
                <KindMark kind={device.kind} label={false} />
                <strong>{device.name}</strong>
              </span>
              <button
                aria-label={`Убрать ${device.name}`}
                className={styles.remove}
                onClick={() => onChange(ids.filter((id) => id !== device.id))}
                type="button"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3>Добавить</h3>
        {available.length === 0 ? <p>Все устройства уже на стене.</p> : null}
        <ul className={styles.pool}>
          {available.map((device) => (
            <li key={device.id}>
              <span className={styles.meta}>
                <KindMark kind={device.kind} label={false} />
                <strong>{device.name}</strong>
              </span>
              <button onClick={() => onChange([...ids, device.id])} type="button">
                Добавить
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
