import type {CameraDevice, Device, NetworkSettings} from './types';

export const DEFAULT_WAN_HOST = '185.199.162.89';
export const DEFAULT_ONVIF_PORT = 13554;
export const DEFAULT_GO2RTC_URL = 'http://127.0.0.1:1984';
export const VISIT_LIMIT = 200;
export const FRAME_CHANGE_LIMIT = 40;

export function createDefaultSettings(): NetworkSettings {
  return {
    lanHost: '',
    wanHost: DEFAULT_WAN_HOST,
    go2rtcUrl: DEFAULT_GO2RTC_URL,
  };
}

export function createSeedDevices(now = Date.now()): Device[] {
  const camera: CameraDevice = {
    id: 'camera-onvif-1',
    kind: 'camera',
    name: 'Камера 1 (ONVIF)',
    room: 'Дом',
    viewMode: 'snapshot',
    rtspUrl: '',
    go2rtcName: 'camera1',
    mainRtspUrl: '',
    mainGo2rtcName: '',
    aspect: 'native',
    snapshotUrl: '',
    mjpegUrl: '',
    iframeUrl: '',
    onvifHost: '{wan}',
    onvifPort: DEFAULT_ONVIF_PORT,
    createdAt: now,
    updatedAt: now,
  };
  return [camera];
}
