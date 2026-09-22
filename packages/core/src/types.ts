export const SNAPSHOT_VERSION = 1 as const;

export type DeviceKind = 'camera' | 'iframe' | 'link';

export type CameraViewMode = 'snapshot' | 'mjpeg' | 'iframe' | 'go2rtc' | 'external';

export type CameraStreamRole = 'preview' | 'main';

export type CameraAspect = 'native' | '16:9' | '16:10' | '4:3';

export type WallLayout = '2x2' | '1+3' | 'custom';

export type VisitKind = 'app' | 'device' | 'wall';

type DeviceBase = {
  id: string;
  name: string;
  room?: string;
  createdAt: number;
  updatedAt: number;
};

export type CameraDevice = DeviceBase & {
  kind: 'camera';
  viewMode: CameraViewMode;
  rtspUrl?: string;
  go2rtcName?: string;
  mainRtspUrl?: string;
  mainGo2rtcName?: string;
  aspect?: CameraAspect;
  snapshotUrl?: string;
  mjpegUrl?: string;
  iframeUrl?: string;
  onvifHost?: string;
  onvifPort?: number;
};

export type IframeDevice = DeviceBase & {
  kind: 'iframe';
  url: string;
};

export type LinkDevice = DeviceBase & {
  kind: 'link';
  url: string;
};

export type Device = CameraDevice | IframeDevice | LinkDevice;

export type CameraWall = {
  id: string;
  name: string;
  layout: WallLayout;
  dashboardLayout?: WallLayout;
  deviceIds: string[];
  onDashboard: boolean;
  createdAt: number;
  updatedAt: number;
};

export type Visit = {
  id: string;
  at: number;
  kind: VisitKind;
  targetId?: string;
  title: string;
};

export type HomeAccount = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type NetworkSettings = {
  lanHost: string;
  wanHost: string;
  go2rtcUrl: string;
  watchFrames?: boolean;
  routerHost?: string;
  routerUser?: string;
  routerPassword?: string;
};

export type FrameChange = {
  id: string;
  at: number;
  deviceId: string;
  deviceName: string;
  before: string;
  after: string;
  box?: {x: number; y: number; w: number; h: number};
};

export type HomeSnapshot = {
  version: typeof SNAPSHOT_VERSION;
  devices: Device[];
  walls: CameraWall[];
  visits: Visit[];
  settings: NetworkSettings;
};

export type NewVisit = Omit<Visit, 'id'> & {id?: string};
