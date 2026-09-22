'use client';

import {useHomeData} from '@/domains/shell/HomeDataContext';
import {
  FRAME_DIFF_HEIGHT,
  FRAME_DIFF_WIDTH,
  classifyFrameChange,
  go2rtcFrameUrl,
  type CameraDevice,
  type Device,
  type FrameBox,
  type FrameChangeKind,
} from '@smartosa/core';
import {useEffect, useRef} from 'react';

const POLL_MS = 10_000;
const SETTLE_THRESHOLD = 8;
const STABLE_TICKS = 2;

type Sample = {
  sig: number[];
  image: string;
};

type Pending = Sample & {
  before: string;
  at: number;
  stable: number;
  kind: FrameChangeKind;
  box: FrameBox | null;
};

function isCamera(device: Device): device is CameraDevice {
  return device.kind === 'camera';
}

function meanAbs(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (!length) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Math.abs(left[index] - right[index]);
  }
  return sum / length;
}

async function grab(url: string): Promise<Sample | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  let response: Response;
  try {
    response = await fetch(url, {cache: 'no-store', signal: controller.signal});
  } finally {
    window.clearTimeout(timer);
  }
  if (!response.ok) {
    return null;
  }
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const grid = document.createElement('canvas');
    grid.width = FRAME_DIFF_WIDTH;
    grid.height = FRAME_DIFF_HEIGHT;
    const gridContext = grid.getContext('2d', {willReadFrequently: true});
    if (!gridContext) {
      return null;
    }
    gridContext.drawImage(bitmap, 0, 0, FRAME_DIFF_WIDTH, FRAME_DIFF_HEIGHT);
    const pixels = gridContext.getImageData(0, 0, grid.width, grid.height).data;
    const sig: number[] = [];
    for (let index = 0; index < pixels.length; index += 4) {
      sig.push(pixels[index] * 0.3 + pixels[index + 1] * 0.59 + pixels[index + 2] * 0.11);
    }

    const scale = Math.min(1, 480 / bitmap.width);
    const shot = document.createElement('canvas');
    shot.width = Math.max(1, Math.round(bitmap.width * scale));
    shot.height = Math.max(1, Math.round(bitmap.height * scale));
    const shotContext = shot.getContext('2d');
    if (!shotContext) {
      return null;
    }
    shotContext.drawImage(bitmap, 0, 0, shot.width, shot.height);
    return {sig, image: shot.toDataURL('image/jpeg', 0.6)};
  } finally {
    bitmap.close();
  }
}

export function FrameWatch() {
  const {settings, devices, go2rtcOnline, activeHome, repo, publishFrameChange} = useHomeData();
  const devicesRef = useRef(devices);
  const settingsRef = useRef(settings);
  devicesRef.current = devices;
  settingsRef.current = settings;

  useEffect(() => {
    if (!settings.watchFrames || go2rtcOnline === false) {
      return;
    }
    const baselines = new Map<string, Sample>();
    const pending = new Map<string, Pending>();
    let cancelled = false;
    let running = false;

    const tick = async () => {
      if (running || cancelled) {
        return;
      }
      running = true;
      try {
        for (const device of devicesRef.current) {
          if (cancelled || !isCamera(device)) {
            continue;
          }
          const url = go2rtcFrameUrl(device, settingsRef.current);
          if (!url) {
            continue;
          }
          let sample: Sample | null = null;
          try {
            sample = await grab(url);
          } catch {
            sample = null;
          }
          if (!sample || cancelled) {
            continue;
          }
          const base = baselines.get(device.id);
          if (!base) {
            baselines.set(device.id, sample);
            continue;
          }
          const verdict = classifyFrameChange(base.sig, sample.sig);
          if (verdict.kind === 'none') {
            pending.delete(device.id);
            continue;
          }
          const current = pending.get(device.id);
          const held =
            current &&
            current.kind === verdict.kind &&
            meanAbs(current.sig, sample.sig) < SETTLE_THRESHOLD;
          if (!held || !current) {
            pending.set(device.id, {
              ...sample,
              before: base.image,
              at: Date.now(),
              stable: 1,
              kind: verdict.kind,
              box: verdict.box,
            });
            continue;
          }
          if (current.stable + 1 < STABLE_TICKS) {
            pending.set(device.id, {...current, ...sample, stable: current.stable + 1, box: verdict.box});
            continue;
          }
          baselines.set(device.id, sample);
          pending.delete(device.id);
          if (verdict.kind !== 'object' || !verdict.box) {
            continue;
          }
          const savedChange = await repo.addFrameChange({
            at: current.at,
            deviceId: device.id,
            deviceName: device.name,
            before: current.before,
            after: sample.image,
            box: verdict.box,
          });
          if (!cancelled) {
            publishFrameChange(savedChange);
          }
        }
      } finally {
        running = false;
      }
    };

    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settings.watchFrames, go2rtcOnline, activeHome?.id, repo, publishFrameChange]);

  return null;
}
