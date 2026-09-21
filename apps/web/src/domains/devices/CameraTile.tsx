'use client';

import {
  bustCacheUrl,
  cameraFit,
  cameraFrameRatio,
  cameraPreviewUrl,
  cameraStreamName,
  deviceOpenUrl,
  go2rtcBaseUrl,
  go2rtcPublishUrl,
  hasEmbeddedUserinfo,
  resolveHostTemplate,
  type CameraDevice,
  type CameraStreamRole,
  type NetworkSettings,
} from '@smartosa/core';
import {KindMark} from '@/domains/ui';
import {Settings} from 'lucide-react';
import Link from 'next/link';
import {useEffect, useState, type CSSProperties} from 'react';
import {useHomeData} from '@/domains/shell/HomeDataContext';
import {useCameraSlot, useNativeFrame} from './CameraSession';
import styles from './CameraTile.module.css';

type Props = {
  device: CameraDevice;
  settings: NetworkSettings;
  refreshMs?: number;
  streamRole?: CameraStreamRole;
  openHref?: string;
  onActivate?: () => void;
  controls?: boolean;
  fill?: boolean;
  onMainLive?: () => void;
};

export function CameraTile({
  device,
  settings,
  refreshMs = 2000,
  streamRole = 'preview',
  openHref,
  onActivate,
  controls = true,
  fill = false,
  onMainLive,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const [mainReady, setMainReady] = useState(streamRole !== 'main');
  const [mainLive, setMainLive] = useState(streamRole !== 'main');
  const [mainError, setMainError] = useState('');
  const preview = cameraPreviewUrl(device, settings, streamRole);
  const streamName = cameraStreamName(device, streamRole);
  const nativeFrame = useNativeFrame(streamName);
  const forcedRatio = cameraFrameRatio(device.aspect);
  const ratio =
    streamRole === 'preview' ? forcedRatio : forcedRatio ?? (nativeFrame ? `${nativeFrame.width} / ${nativeFrame.height}` : null);
  const fit = cameraFit(device.aspect);
  const openUrl = deviceOpenUrl(device, settings);
  const {go2rtcOnline} = useHomeData();
  const cheapPreview = cameraPreviewUrl(device, settings, 'preview');
  const mainName = cameraStreamName(device, 'main');
  const showCheapStream = streamRole === 'main' && !mainLive && go2rtcOnline !== false && Boolean(cheapPreview);
  const persistPreview =
    (streamRole === 'preview' &&
      ((device.viewMode === 'go2rtc' && go2rtcOnline === true) || device.viewMode === 'iframe')) ||
    showCheapStream;
  const slotRef = useCameraSlot(device.id, persistPreview && Boolean(streamRole === 'main' ? cheapPreview : preview), 'preview');
  const usesGo2rtc =
    streamRole === 'main' ||
    device.viewMode === 'go2rtc' ||
    Boolean(preview?.startsWith(go2rtcBaseUrl(settings)));
  const go2rtcDown = go2rtcOnline === false && (device.viewMode === 'go2rtc' || usesGo2rtc);
  const isImage = device.viewMode === 'snapshot' || device.viewMode === 'mjpeg';
  const blockedAuth =
    (device.viewMode === 'snapshot' &&
      Boolean(
        device.snapshotUrl && hasEmbeddedUserinfo(resolveHostTemplate(device.snapshotUrl, settings)),
      )) ||
    (device.viewMode === 'mjpeg' &&
      Boolean(device.mjpegUrl && hasEmbeddedUserinfo(resolveHostTemplate(device.mjpegUrl, settings))));
  const showBlockedAuthHint = blockedAuth && !usesGo2rtc;

  useEffect(() => {
    if (device.viewMode !== 'snapshot') {
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), refreshMs);
    return () => window.clearInterval(timer);
  }, [device.viewMode, refreshMs]);

  useEffect(() => {
    setFailed(false);
  }, [preview, device.viewMode]);

  useEffect(() => {
    if (streamRole !== 'main') {
      return;
    }
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'smartosa-video-playing' || data.src !== mainName) {
        return;
      }
      setMainLive(true);
      onMainLive?.();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [mainName, onMainLive, streamRole]);

  useEffect(() => {
    if (streamRole !== 'main') {
      setMainReady(true);
      setMainError('');
      return;
    }
    const rtsp = device.mainRtspUrl?.trim() || device.rtspUrl?.trim() || '';
    if (!rtsp) {
      setMainReady(false);
      setMainError('Нет RTSP для главного потока');
      return;
    }
    if (go2rtcOnline === false) {
      setMainReady(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4000);
    setMainReady(false);
    setMainError('');
    const name = cameraStreamName(device, 'main');
    fetch(go2rtcPublishUrl(settings, name, rtsp, 'main'), {method: 'PUT', signal: controller.signal})
      .then((response) => {
        if (!response.ok) {
          throw new Error(`go2rtc ответил ${response.status}`);
        }
        if (!cancelled) {
          setMainReady(true);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          setMainReady(true);
          return;
        }
        setMainReady(false);
        setMainError(error instanceof Error ? error.message : 'Не удалось открыть главный поток');
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    device.go2rtcName,
    device.mainGo2rtcName,
    device.mainRtspUrl,
    device.rtspUrl,
    go2rtcOnline,
    settings,
    streamRole,
  ]);

  const ar = ratio ?? '16 / 9';
  return (
    <article
      className={fill ? `${styles.tile} ${styles.tileFill}` : controls ? styles.tile : `${styles.tile} ${styles.plain}`}
      style={fill ? ({'--ar': ar} as CSSProperties) : undefined}
    >
      <div
        className={fit === 'fill' ? styles.stageFill : styles.stage}
        ref={persistPreview ? slotRef : undefined}
        style={fill || !ratio ? undefined : {aspectRatio: ratio}}
      >
        {onActivate ? (
          <button
            aria-label={`Показать ${device.name} крупно`}
            className={styles.open}
            onClick={onActivate}
            type="button"
          />
        ) : openHref ? (
          <Link aria-label={device.name} className={styles.open} href={openHref} />
        ) : null}
        {streamRole === 'main' && mainReady && preview ? (
          <iframe
            allow="autoplay; fullscreen"
            className={showCheapStream ? styles.mainPending : undefined}
            src={preview}
            title={device.name}
          />
        ) : null}
        {isImage && preview && !failed && !go2rtcDown ? (
          <img
            alt={device.name}
            onError={() => setFailed(true)}
            src={device.viewMode === 'snapshot' ? bustCacheUrl(preview, now) : preview}
          />
        ) : null}
        {(go2rtcDown ||
          !preview ||
          failed ||
          showBlockedAuthHint ||
          device.viewMode === 'external' ||
          (streamRole === 'main' && !mainReady && !showCheapStream && !mainLive)) && (
          <div className={styles.fallback}>
            <p>
              {go2rtcDown
                ? 'go2rtc не запущен. В терминале: pnpm go2rtc:up'
                : streamRole === 'main' && !mainReady
                  ? mainError || 'Подключаю главный поток…'
                  : failed
                    ? 'Нет сигнала'
                  : showBlockedAuthHint
                    ? 'Chrome не открывает snapshot с логином в URL. Запустите go2rtc и выберите живое видео.'
                    : device.rtspUrl
                      ? 'RTSP сохранён. Для живого видео запустите go2rtc и нажмите «Отдать RTSP».'
                      : 'Нет URL для просмотра'}
            </p>
            {device.onvifHost ? (
              <small>
                ONVIF {device.onvifHost}:{device.onvifPort ?? '—'}
              </small>
            ) : null}
            {openUrl && !openHref ? (
              <a href={openUrl} rel="noreferrer" target="_blank">
                Открыть в новой вкладке
              </a>
            ) : null}
          </div>
        )}
      </div>
      {streamRole === 'preview' && controls ? (
        <footer className={styles.footer}>
          <div className={styles.caption}>
            <KindMark kind="camera" label={false} />
            <strong>{device.name}</strong>
            {device.room ? <span className={styles.room}>{device.room}</span> : null}
          </div>
          <Link
            aria-label={`Настроить ${device.name}`}
            className={styles.settings}
            href={`/devices/edit?id=${device.id}`}
            title="Настроить"
          >
            <Settings size={16} />
          </Link>
        </footer>
      ) : null}
    </article>
  );
}
