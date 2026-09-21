import type {CameraWall, Device, HomeAccount, HomeSnapshot, NetworkSettings, NewVisit, Visit} from './types';

export type HomeRepository = {
  listHomes(): Promise<HomeAccount[]>;
  activeHome(): Promise<HomeAccount>;
  createHome(name: string): Promise<HomeAccount>;
  renameHome(id: string, name: string): Promise<HomeAccount>;
  deleteHome(id: string): Promise<void>;
  switchHome(id: string): Promise<HomeAccount>;

  listDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | null>;
  upsertDevice(device: Device): Promise<Device>;
  deleteDevice(id: string): Promise<void>;

  listWalls(): Promise<CameraWall[]>;
  getWall(id: string): Promise<CameraWall | null>;
  upsertWall(wall: CameraWall): Promise<CameraWall>;
  deleteWall(id: string): Promise<void>;

  listVisits(limit?: number): Promise<Visit[]>;
  logVisit(visit: NewVisit): Promise<Visit>;

  getSettings(): Promise<NetworkSettings>;
  setSettings(settings: NetworkSettings): Promise<NetworkSettings>;

  exportSnapshot(): Promise<HomeSnapshot>;
  importSnapshot(snapshot: HomeSnapshot): Promise<void>;
};
