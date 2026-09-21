import {createDefaultSettings} from './defaults';
import type {
  CameraAspect,
  CameraDevice,
  CameraViewMode,
  CameraWall,
  Device,
  DeviceKind,
  HomeSnapshot,
  IframeDevice,
  LinkDevice,
  NetworkSettings,
  Visit,
  VisitKind,
  WallLayout,
} from './types';
import {SNAPSHOT_VERSION} from './types';

const DEVICE_KINDS: DeviceKind[] = ['camera', 'iframe', 'link'];
const VIEW_MODES: CameraViewMode[] = ['snapshot', 'mjpeg', 'iframe', 'go2rtc', 'external'];
const CAMERA_ASPECTS: CameraAspect[] = ['native', '16:9', '16:10', '4:3'];
const WALL_LAYOUTS: WallLayout[] = ['2x2', '1+3', 'custom'];
const VISIT_KINDS: VisitKind[] = ['app', 'device', 'wall'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function readOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new Error('Invalid optional string');
  }
  return value;
}

function readNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return value;
}

function readAspect(value: unknown): CameraAspect {
  if (typeof value === 'string' && CAMERA_ASPECTS.includes(value as CameraAspect)) {
    return value as CameraAspect;
  }
  return 'native';
}

function readOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return readNumber(value, 'number');
}

export function parseDevice(raw: unknown): Device {
  if (!isRecord(raw)) {
    throw new Error('Invalid device');
  }
  const kind = raw.kind;
  if (typeof kind !== 'string' || !DEVICE_KINDS.includes(kind as DeviceKind)) {
    throw new Error('Invalid device kind');
  }

  const base = {
    id: readString(raw.id, 'device.id'),
    name: readString(raw.name, 'device.name'),
    room: readOptionalString(raw.room),
    createdAt: readNumber(raw.createdAt, 'device.createdAt'),
    updatedAt: readNumber(raw.updatedAt, 'device.updatedAt'),
  };

  if (kind === 'camera') {
    const viewMode = raw.viewMode;
    if (typeof viewMode !== 'string' || !VIEW_MODES.includes(viewMode as CameraViewMode)) {
      throw new Error('Invalid camera viewMode');
    }
    const device: CameraDevice = {
      ...base,
      kind: 'camera',
      viewMode: viewMode as CameraViewMode,
      rtspUrl: readOptionalString(raw.rtspUrl) ?? '',
      go2rtcName: readOptionalString(raw.go2rtcName) ?? 'camera1',
      mainRtspUrl: readOptionalString(raw.mainRtspUrl) ?? '',
      mainGo2rtcName: readOptionalString(raw.mainGo2rtcName) ?? '',
      aspect: readAspect(raw.aspect),
      snapshotUrl: readOptionalString(raw.snapshotUrl) ?? '',
      mjpegUrl: readOptionalString(raw.mjpegUrl) ?? '',
      iframeUrl: readOptionalString(raw.iframeUrl) ?? '',
      onvifHost: readOptionalString(raw.onvifHost),
      onvifPort: readOptionalNumber(raw.onvifPort),
    };
    return device;
  }

  if (kind === 'iframe') {
    const device: IframeDevice = {
      ...base,
      kind: 'iframe',
      url: readString(raw.url, 'iframe.url'),
    };
    return device;
  }

  const device: LinkDevice = {
    ...base,
    kind: 'link',
    url: readString(raw.url, 'link.url'),
  };
  return device;
}

export function parseWall(raw: unknown): CameraWall {
  if (!isRecord(raw)) {
    throw new Error('Invalid wall');
  }
  const layout = raw.layout;
  if (typeof layout !== 'string' || !WALL_LAYOUTS.includes(layout as WallLayout)) {
    throw new Error('Invalid wall layout');
  }
  const ids = Array.isArray(raw.deviceIds) ? raw.deviceIds : raw.cameraIds;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new Error('Invalid wall deviceIds');
  }
  const dashboardLayout = WALL_LAYOUTS.includes(raw.dashboardLayout as WallLayout)
    ? (raw.dashboardLayout as WallLayout)
    : undefined;
  return {
    id: readString(raw.id, 'wall.id'),
    name: readString(raw.name, 'wall.name'),
    layout: layout as WallLayout,
    ...(dashboardLayout ? {dashboardLayout} : {}),
    deviceIds: ids as string[],
    onDashboard: raw.onDashboard === true,
    createdAt: readNumber(raw.createdAt, 'wall.createdAt'),
    updatedAt: readNumber(raw.updatedAt, 'wall.updatedAt'),
  };
}

export function parseVisit(raw: unknown): Visit {
  if (!isRecord(raw)) {
    throw new Error('Invalid visit');
  }
  const kind = raw.kind;
  if (typeof kind !== 'string' || !VISIT_KINDS.includes(kind as VisitKind)) {
    throw new Error('Invalid visit kind');
  }
  const targetId = readOptionalString(raw.targetId);
  return {
    id: readString(raw.id, 'visit.id'),
    at: readNumber(raw.at, 'visit.at'),
    kind: kind as VisitKind,
    ...(targetId ? {targetId} : {}),
    title: readString(raw.title, 'visit.title'),
  };
}

export function parseSettings(raw: unknown): NetworkSettings {
  if (!isRecord(raw)) {
    return createDefaultSettings();
  }
  const defaults = createDefaultSettings();
  return {
    lanHost: typeof raw.lanHost === 'string' ? raw.lanHost : '',
    wanHost: typeof raw.wanHost === 'string' ? raw.wanHost : defaults.wanHost,
    go2rtcUrl: typeof raw.go2rtcUrl === 'string' && raw.go2rtcUrl ? raw.go2rtcUrl : defaults.go2rtcUrl,
  };
}

export function parseSnapshot(raw: string | unknown): HomeSnapshot {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!isRecord(data)) {
    throw new Error('Invalid snapshot');
  }
  if (data.version !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported snapshot version: ${String(data.version)}`);
  }
  if (!Array.isArray(data.devices) || !Array.isArray(data.walls) || !Array.isArray(data.visits)) {
    throw new Error('Invalid snapshot collections');
  }
  return {
    version: SNAPSHOT_VERSION,
    devices: data.devices.map(parseDevice),
    walls: data.walls.map(parseWall),
    visits: data.visits.map(parseVisit),
    settings: parseSettings(data.settings),
  };
}

export function serializeDevice(device: Device): string {
  return JSON.stringify(device);
}

export function serializeWall(wall: CameraWall): string {
  return JSON.stringify(wall);
}

export function serializeVisit(visit: Visit): string {
  return JSON.stringify(visit);
}

export function serializeSnapshot(snapshot: HomeSnapshot): string {
  return JSON.stringify(snapshot);
}
