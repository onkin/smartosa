import type {CameraAspect, CameraDevice, CameraStreamRole, Device, NetworkSettings} from './types';

export function resolveHostTemplate(value: string, settings: NetworkSettings): string {
  return value.replaceAll('{lan}', settings.lanHost).replaceAll('{wan}', settings.wanHost);
}

export function go2rtcBaseUrl(settings: NetworkSettings): string {
  const raw = (settings.go2rtcUrl || 'http://127.0.0.1:1984').replace(/\/$/, '');
  if (typeof window === 'undefined') {
    return raw;
  }
  try {
    const url = new URL(raw);
    const pageHost = window.location.hostname;
    const pointsHere = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
    const pageIsLocal = pageHost === '127.0.0.1' || pageHost === 'localhost' || pageHost === '';
    if (pointsHere && !pageIsLocal) {
      url.hostname = pageHost;
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    return raw;
  }
  return raw;
}

export function hasEmbeddedUserinfo(url: string): boolean {
  try {
    const parsed = new URL(url);
    return Boolean(parsed.username || parsed.password);
  } catch {
    return /:\/\/[^/?#]*@/.test(url);
  }
}

export function cameraStreamName(device: CameraDevice, role: CameraStreamRole = 'preview'): string {
  if (role === 'main') {
    const explicit = device.mainGo2rtcName?.trim();
    if (explicit) {
      return explicit;
    }
    const preview = device.go2rtcName?.trim() || 'camera1';
    return `${preview}-main`;
  }
  return device.go2rtcName?.trim() || 'camera1';
}

export function cameraFrameRatio(aspect: CameraAspect | undefined): string | null {
  if (!aspect || aspect === 'native') {
    return null;
  }
  return aspect.replace(':', ' / ');
}

export function cameraFit(aspect: CameraAspect | undefined): 'contain' | 'fill' {
  return !aspect || aspect === 'native' ? 'contain' : 'fill';
}

export function go2rtcFrameUrl(device: CameraDevice, settings: NetworkSettings): string | null {
  const name = cameraStreamName(device, 'preview');
  if (!name) {
    return null;
  }
  return `${go2rtcBaseUrl(settings)}/api/frame.jpeg?src=${encodeURIComponent(name)}`;
}

export function go2rtcStreamPageUrl(
  device: CameraDevice,
  settings: NetworkSettings,
  role: CameraStreamRole = 'preview',
): string | null {
  const name = cameraStreamName(device, role);
  if (!name) {
    return null;
  }
  return `${go2rtcBaseUrl(settings)}/stream.html?src=${encodeURIComponent(name)}`;
}

export function go2rtcPlayerUrl(
  device: CameraDevice,
  settings: NetworkSettings,
  role: CameraStreamRole = 'preview',
): string | null {
  const name = cameraStreamName(device, role);
  if (!name) {
    return null;
  }
  const params = new URLSearchParams({
    go2rtc: go2rtcBaseUrl(settings),
    src: name,
    fit: cameraFit(device.aspect),
  });
  return `/camera-player.html?${params.toString()}`;
}

export function go2rtcVideoUrl(device: CameraDevice, settings: NetworkSettings): string | null {
  const name = device.go2rtcName?.trim();
  if (!name) {
    return null;
  }
  return `${go2rtcBaseUrl(settings)}/api/stream.mp4?src=${encodeURIComponent(name)}`;
}

export function cameraPreviewUrl(
  device: CameraDevice,
  settings: NetworkSettings,
  role: CameraStreamRole = 'preview',
): string | null {
  if (role === 'main' || device.viewMode === 'go2rtc') {
    return go2rtcPlayerUrl(device, settings, role);
  }
  if (device.viewMode === 'snapshot' && device.snapshotUrl) {
    const snapshot = resolveHostTemplate(device.snapshotUrl, settings);
    if (!hasEmbeddedUserinfo(snapshot)) {
      return snapshot;
    }
    return go2rtcFrameUrl(device, settings);
  }
  if (device.viewMode === 'mjpeg' && device.mjpegUrl) {
    const mjpeg = resolveHostTemplate(device.mjpegUrl, settings);
    if (!hasEmbeddedUserinfo(mjpeg)) {
      return mjpeg;
    }
    return go2rtcPlayerUrl(device, settings);
  }
  if (device.viewMode === 'iframe' && device.iframeUrl) {
    return resolveHostTemplate(device.iframeUrl, settings);
  }
  return null;
}

export function cameraWebUrls(
  device: CameraDevice,
  settings: NetworkSettings,
): {label: string; href: string}[] {
  const links: {label: string; href: string}[] = [];
  const iframe = device.iframeUrl?.trim();
  if (iframe) {
    links.push({label: 'Веб-морда', href: resolveHostTemplate(iframe, settings)});
  }
  const host = device.onvifHost?.trim();
  if (host) {
    const resolvedHost = resolveHostTemplate(host, settings);
    const href = /^https?:\/\//i.test(resolvedHost)
      ? resolvedHost
      : `http://${resolvedHost}${device.onvifPort ? `:${device.onvifPort}` : ''}/`;
    const known = links.some((item) => item.href.replace(/\/$/, '') === href.replace(/\/$/, ''));
    if (!known) {
      links.push({label: links.length === 0 ? 'Веб-морда' : 'ONVIF', href});
    }
  }
  return links;
}

export function deviceOpenUrl(device: Device, settings: NetworkSettings): string | null {
  if (device.kind === 'camera') {
    if (device.viewMode === 'go2rtc') {
      return go2rtcStreamPageUrl(device, settings);
    }
    if (device.iframeUrl) {
      return resolveHostTemplate(device.iframeUrl, settings);
    }
    return cameraPreviewUrl(device, settings);
  }
  return device.url ? resolveHostTemplate(device.url, settings) : null;
}

export function bustCacheUrl(url: string, at = Date.now()): string {
  const glue = url.includes('?') ? '&' : '?';
  return `${url}${glue}t=${at}`;
}

export function go2rtcPublishUrl(
  settings: NetworkSettings,
  name: string,
  rtspUrl: string,
  role: CameraStreamRole = 'preview',
): string {
  const src = browserRtspSource(resolveHostTemplate(rtspUrl, settings), role);
  const params = new URLSearchParams({name, src});
  return `${go2rtcBaseUrl(settings)}/api/streams?${params.toString()}`;
}

function withRtspSubtype(rtspUrl: string, subtype: 0 | 1): string {
  if (!/subtype=\d+/i.test(rtspUrl)) {
    return rtspUrl;
  }
  return rtspUrl.replace(/subtype=\d+/i, `subtype=${subtype}`);
}

/** Dahua main stream (subtype=0) is the heavy stream for a single camera. */
export function preferRtspMainstream(rtspUrl: string): string {
  return withRtspSubtype(rtspUrl, 0);
}

/** Dahua substream (subtype=1) is the light stream for walls and previews. */
export function preferRtspSubstream(rtspUrl: string): string {
  return withRtspSubtype(rtspUrl, 1);
}

/** Light, video-only RTSP that go2rtc can keep reconnecting. */
export function browserRtspSource(rtspUrl: string, role: CameraStreamRole = 'preview'): string {
  const bare = rtspUrl.split('#')[0] ?? rtspUrl;
  const tuned = role === 'main' ? preferRtspMainstream(bare) : preferRtspSubstream(bare);
  return `${tuned}#media=video#timeout=60`;
}

export function isRtspUrl(value: string): boolean {
  return /^rtsps?:\/\//i.test(value.trim());
}

/** Dahua / Amcrest / IMOU: RTSP /cam/realmonitor → HTTP snapshot. */
export function suggestSnapshotFromRtsp(rtsp: string): string | null {
  const placeholders = [
    ['{wan}', '__wan__'],
    ['{lan}', '__lan__'],
  ] as const;
  let normalized = rtsp.trim();
  for (const [token, fake] of placeholders) {
    normalized = normalized.replaceAll(token, fake);
  }
  try {
    const url = new URL(normalized);
    if (url.protocol !== 'rtsp:' && url.protocol !== 'rtsps:') {
      return null;
    }
    const path = url.pathname.toLowerCase();
    if (!path.includes('realmonitor') && !path.includes('/cam/')) {
      return null;
    }
    const channel = url.searchParams.get('channel') ?? '1';
    const auth = url.username
      ? `${decodeURIComponent(url.username)}${url.password ? `:${decodeURIComponent(url.password)}` : ''}@`
      : '';
    let snapshot = `http://${auth}${url.hostname}/cgi-bin/snapshot.cgi?channel=${channel}`;
    for (const [token, fake] of placeholders) {
      snapshot = snapshot.replaceAll(fake, token);
    }
    return snapshot;
  } catch {
    return null;
  }
}
