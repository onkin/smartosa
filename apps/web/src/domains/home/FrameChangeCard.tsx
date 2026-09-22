'use client';

import {formatWhen} from '@/domains/devices/labels';
import {Button} from '@/domains/ui';
import {
  FRAME_DIFF_HEIGHT,
  FRAME_DIFF_WIDTH,
  frameChangeBox,
  type FrameBox,
  type FrameChange,
} from '@smartosa/core';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import styles from './HomeScreen.module.css';

type Props = {
  change: FrameChange;
  onDelete: (id: string) => void;
};

function markStyle(box: FrameBox): {height: string; left: string; top: string; width: string} {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.w * 100}%`,
    height: `${box.h * 100}%`,
  };
}

async function lumaGrid(url: string): Promise<number[] | null> {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement('canvas');
    canvas.width = FRAME_DIFF_WIDTH;
    canvas.height = FRAME_DIFF_HEIGHT;
    const context = canvas.getContext('2d', {willReadFrequently: true});
    if (!context) {
      return null;
    }
    context.drawImage(bitmap, 0, 0, FRAME_DIFF_WIDTH, FRAME_DIFF_HEIGHT);
    const pixels = context.getImageData(0, 0, FRAME_DIFF_WIDTH, FRAME_DIFF_HEIGHT).data;
    const values: number[] = [];
    for (let index = 0; index < pixels.length; index += 4) {
      values.push(pixels[index] * 0.3 + pixels[index + 1] * 0.59 + pixels[index + 2] * 0.11);
    }
    return values;
  } finally {
    bitmap.close();
  }
}

async function measureBox(before: string, after: string): Promise<FrameBox | null> {
  const [left, right] = await Promise.all([lumaGrid(before), lumaGrid(after)]);
  if (!left || !right) {
    return null;
  }
  return frameChangeBox(left, right);
}

export function FrameChangeCard({change, onDelete}: Props) {
  const [box, setBox] = useState<FrameBox | null>(change.box ?? null);

  useEffect(() => {
    if (change.box) {
      setBox(change.box);
      return;
    }
    let cancelled = false;
    void measureBox(change.before, change.after)
      .then((next) => {
        if (!cancelled) {
          setBox(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [change]);

  const wide = Boolean(box && box.w * box.h >= 0.85);

  return (
    <>
      <div className={styles.changeHead}>
        <Link href={`/devices/view?id=${change.deviceId}`}>
          <strong>{change.deviceName}</strong>
        </Link>
        <div className={styles.changeMeta}>
          <time dateTime={new Date(change.at).toISOString()}>{formatWhen(change.at)}</time>
          <Button onClick={() => onDelete(change.id)} variant="ghost">
            Удалить
          </Button>
        </div>
      </div>
      <div className={styles.pair}>
        <figure>
          <div className={styles.shot}>
            <img alt={`Кадр до, ${change.deviceName}`} src={change.before} />
            {box ? <span className={styles.mark} style={markStyle(box)} /> : null}
          </div>
          <figcaption>До</figcaption>
        </figure>
        <figure>
          <div className={styles.shot}>
            <img alt={`Кадр после, ${change.deviceName}`} src={change.after} />
            {box ? <span className={styles.mark} style={markStyle(box)} /> : null}
          </div>
          <figcaption>После</figcaption>
        </figure>
      </div>
      {wide ? <p className={styles.watchNote}>Рамка на весь кадр: сдвинулась почти вся картинка.</p> : null}
    </>
  );
}
