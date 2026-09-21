'use client';

import {useEffect, useState} from 'react';
import styles from './EmbedFrame.module.css';

type Props = {
  allow?: string;
  className?: string;
  src: string;
  title: string;
};

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

export function EmbedFrame({allow, className, src, title}: Props) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setBlocked(false);
  }, [src]);

  if (blocked) {
    return (
      <div className={[styles.fallback, className].filter(Boolean).join(' ')}>
        <p>Этот сайт запрещает открытие внутри панели.</p>
        <a href={src} rel="noreferrer" target="_blank">
          Открыть в новой вкладке
        </a>
      </div>
    );
  }

  return (
    <iframe
      allow={allow}
      className={className}
      onLoad={(event) => {
        if (!isCrossOrigin(src)) {
          return;
        }
        const frame = event.currentTarget;
        window.setTimeout(() => {
          if (frame.isConnected && frameWasBlocked(frame)) {
            setBlocked(true);
          }
        }, 400);
      }}
      src={src}
      title={title}
    />
  );
}
