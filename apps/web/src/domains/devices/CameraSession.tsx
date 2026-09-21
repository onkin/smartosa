'use client';

import {cameraPreviewUrl, type CameraStreamRole} from '@smartosa/core';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {useHomeData} from '@/domains/shell/HomeDataContext';
import styles from './CameraSession.module.css';

type SlotMap = Record<string, HTMLElement>;

type FrameSize = {height: number; width: number};

type CameraSessionApi = {
  frames: Record<string, FrameSize>;
  parkSlot: (slotId: string, node: HTMLElement) => void;
  registerSlot: (slotId: string, node: HTMLElement) => void;
};

const CameraSessionContext = createContext<CameraSessionApi | null>(null);

export function CameraSessionProvider({children}: {children: ReactNode}) {
  const [slots, setSlots] = useState<SlotMap>({});
  const [frames, setFrames] = useState<Record<string, FrameSize>>({});
  const parkRef = useRef<HTMLDivElement>(null);
  const playerFramesRef = useRef(new Map<string, HTMLIFrameElement>());

  const registerSlot = useCallback((slotId: string, node: HTMLElement) => {
    setSlots((current) => (current[slotId] === node ? current : {...current, [slotId]: node}));
  }, []);

  const parkSlot = useCallback((slotId: string, node: HTMLElement) => {
    const park = parkRef.current;
    const frame = playerFramesRef.current.get(slotId);
    if (park && frame && frame.parentElement === node) {
      park.appendChild(frame);
    }
    setSlots((current) => {
      if (current[slotId] !== node) {
        return current;
      }
      const next = {...current};
      delete next[slotId];
      return next;
    });
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'smartosa-video-size') {
        return;
      }
      const src = typeof data.src === 'string' ? data.src : '';
      const width = Number(data.width);
      const height = Number(data.height);
      if (!src || !width || !height) {
        return;
      }
      setFrames((current) => {
        const prev = current[src];
        if (prev && prev.width === width && prev.height === height) {
          return current;
        }
        return {...current, [src]: {height, width}};
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const api = useMemo(
    () => ({frames, parkSlot, registerSlot}),
    [frames, parkSlot, registerSlot],
  );

  return (
    <CameraSessionContext.Provider value={api}>
      {children}
      <PersistentCameraLayer framesRef={playerFramesRef} parkRef={parkRef} slots={slots} />
    </CameraSessionContext.Provider>
  );
}

export function useCameraSlot(cameraId: string, enabled: boolean, role: CameraStreamRole = 'preview') {
  const session = useContext(CameraSessionContext);
  const [node, setNode] = useState<HTMLElement | null>(null);
  const slotId = `${role}:${cameraId}`;

  const registerSlot = session?.registerSlot;
  const parkSlot = session?.parkSlot;

  useLayoutEffect(() => {
    if (!enabled || !registerSlot || !parkSlot || !node) {
      return;
    }
    registerSlot(slotId, node);
    return () => parkSlot(slotId, node);
  }, [enabled, node, parkSlot, registerSlot, slotId]);

  return setNode;
}

export function useNativeFrame(streamName: string): FrameSize | null {
  const session = useContext(CameraSessionContext);
  return session?.frames[streamName] ?? null;
}

type Player = {key: string; src: string; title: string};

function isCrossOrigin(src: string): boolean {
  try {
    return new URL(src, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function frameWasBlocked(frame: HTMLIFrameElement): boolean {
  try {
    const href = frame.contentWindow?.location.href ?? '';
    return href === 'about:blank' || href.startsWith('chrome-error:');
  } catch {
    return false;
  }
}

function PersistentCameraLayer({
  framesRef,
  parkRef,
  slots,
}: {
  framesRef: RefObject<Map<string, HTMLIFrameElement>>;
  parkRef: RefObject<HTMLDivElement | null>;
  slots: SlotMap;
}) {
  const {devices, settings, go2rtcOnline} = useHomeData();

  const players = useMemo(() => {
    const list: Player[] = [];
    for (const device of devices) {
      if (device.kind !== 'camera') {
        continue;
      }
      const preview = cameraPreviewUrl(device, settings, 'preview');
      const previewReady =
        device.viewMode === 'iframe'
          ? Boolean(preview)
          : device.viewMode === 'go2rtc' && go2rtcOnline === true && Boolean(preview);
      if (preview && previewReady) {
        list.push({key: `preview:${device.id}`, src: preview, title: device.name});
      }
    }
    return list;
  }, [devices, go2rtcOnline, settings]);

  useLayoutEffect(() => {
    const park = parkRef.current;
    if (!park) {
      return;
    }
    const frames = framesRef.current;
    if (!frames) {
      return;
    }
    const live = new Set(players.map((player) => player.key));
    for (const [key, frame] of frames) {
      if (!live.has(key)) {
        frame.remove();
        frames.delete(key);
      }
    }
    for (const player of players) {
      let frame = frames.get(player.key);
      if (!frame) {
        const created = document.createElement('iframe');
        created.allow = 'autoplay; fullscreen';
        created.className = styles.frame;
        created.title = player.title;
        park.appendChild(created);
        created.src = player.src;
        created.dataset.smartosaSrc = player.src;
        created.addEventListener('load', () => {
          if (created.dataset.blocked === '1' || !isCrossOrigin(created.dataset.smartosaSrc ?? '')) {
            return;
          }
          window.setTimeout(() => {
            if (!created.isConnected || !frameWasBlocked(created)) {
              return;
            }
            created.dataset.blocked = '1';
            created.removeAttribute('src');
            created.srcdoc =
              '<body style="margin:0;display:grid;place-items:center;height:100vh;background:#0d1117;color:#7a8699;font:14px sans-serif;text-align:center;padding:16px">Этот сайт запрещает открытие внутри панели.</body>';
          }, 400);
        });
        frames.set(player.key, created);
        frame = created;
      } else if (frame.dataset.smartosaSrc !== player.src) {
        frame.dataset.blocked = '';
        frame.removeAttribute('srcdoc');
        frame.dataset.smartosaSrc = player.src;
        frame.src = player.src;
      }
      frame.title = player.title;
      const slot = slots[player.key];
      const parent = slot?.isConnected ? slot : park;
      if (frame.parentElement !== parent) {
        parent.appendChild(frame);
      }
    }
  }, [framesRef, parkRef, players, slots]);

  useEffect(() => {
    const frames = framesRef.current;
    return () => {
      for (const frame of frames.values()) {
        frame.remove();
      }
      frames.clear();
    };
  }, []);

  return <div aria-hidden className={styles.park} ref={parkRef} />;
}
