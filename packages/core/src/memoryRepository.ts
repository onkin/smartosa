import {createDefaultSettings, createSeedDevices, VISIT_LIMIT} from './defaults';
import {createId} from './ids';
import {parseSnapshot} from './serialize';
import type {HomeRepository} from './repository';
import type {CameraWall, Device, HomeAccount, HomeSnapshot, NetworkSettings, NewVisit, Visit} from './types';
import {SNAPSHOT_VERSION} from './types';

export type MemoryRepositoryOptions = {
  seed?: boolean;
  now?: () => number;
};

type Bucket = {
  devices: Map<string, Device>;
  walls: Map<string, CameraWall>;
  visits: Visit[];
  settings: NetworkSettings;
};

function emptyBucket(seed: Device[]): Bucket {
  return {
    devices: new Map(seed.map((device) => [device.id, device])),
    walls: new Map(),
    visits: [],
    settings: createDefaultSettings(),
  };
}

export function createMemoryRepository(options: MemoryRepositoryOptions = {}): HomeRepository {
  const now = options.now ?? Date.now;
  const firstId = 'home-default';
  let homes: HomeAccount[] = [{id: firstId, name: 'Дом', createdAt: now(), updatedAt: now()}];
  let activeId = firstId;
  const buckets = new Map<string, Bucket>([
    [firstId, emptyBucket(options.seed === false ? [] : createSeedDevices(now()))],
  ]);

  function bucket(): Bucket {
    const current = buckets.get(activeId);
    if (!current) {
      throw new Error('Active home is missing');
    }
    return current;
  }

  function requireHome(id: string): HomeAccount {
    const home = homes.find((item) => item.id === id);
    if (!home) {
      throw new Error('Дом не найден');
    }
    return home;
  }

  const repo: HomeRepository = {
    async listHomes() {
      return [...homes].sort((a, b) => a.createdAt - b.createdAt);
    },
    async activeHome() {
      return requireHome(activeId);
    },
    async createHome(name) {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('Укажите название дома');
      }
      const stamp = now();
      const home: HomeAccount = {id: createId(), name: trimmed, createdAt: stamp, updatedAt: stamp};
      homes = [...homes, home];
      buckets.set(home.id, emptyBucket([]));
      activeId = home.id;
      return home;
    },
    async renameHome(id, name) {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('Укажите название дома');
      }
      const home = requireHome(id);
      const next = {...home, name: trimmed, updatedAt: now()};
      homes = homes.map((item) => (item.id === id ? next : item));
      return next;
    },
    async deleteHome(id) {
      requireHome(id);
      if (homes.length <= 1) {
        throw new Error('Нельзя удалить единственный дом');
      }
      homes = homes.filter((item) => item.id !== id);
      buckets.delete(id);
      if (activeId === id) {
        activeId = homes[0].id;
      }
    },
    async switchHome(id) {
      const home = requireHome(id);
      activeId = home.id;
      return home;
    },
    async listDevices() {
      return [...bucket().devices.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async getDevice(id) {
      return bucket().devices.get(id) ?? null;
    },
    async upsertDevice(device) {
      bucket().devices.set(device.id, device);
      return device;
    },
    async deleteDevice(id) {
      const current = bucket();
      current.devices.delete(id);
      current.walls = new Map(
        [...current.walls.values()].map((wall) => [
          wall.id,
          {...wall, deviceIds: wall.deviceIds.filter((deviceId) => deviceId !== id)},
        ]),
      );
    },
    async listWalls() {
      return [...bucket().walls.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async getWall(id) {
      return bucket().walls.get(id) ?? null;
    },
    async upsertWall(wall) {
      bucket().walls.set(wall.id, wall);
      return wall;
    },
    async deleteWall(id) {
      bucket().walls.delete(id);
    },
    async listVisits(limit = 20) {
      return bucket().visits.slice(0, limit);
    },
    async logVisit(input) {
      const current = bucket();
      const visit: Visit = {
        id: input.id ?? createId(),
        at: input.at,
        kind: input.kind,
        targetId: input.targetId,
        title: input.title,
      };
      current.visits = [visit, ...current.visits].slice(0, VISIT_LIMIT);
      return visit;
    },
    async getSettings() {
      return bucket().settings;
    },
    async setSettings(next) {
      bucket().settings = next;
      return next;
    },
    async exportSnapshot() {
      const current = bucket();
      return {
        version: SNAPSHOT_VERSION,
        devices: await repo.listDevices(),
        walls: await repo.listWalls(),
        visits: current.visits,
        settings: current.settings,
      };
    },
    async importSnapshot(snapshot) {
      const parsed = parseSnapshot(snapshot);
      const current = bucket();
      current.devices = new Map(parsed.devices.map((device) => [device.id, device]));
      current.walls = new Map(parsed.walls.map((wall) => [wall.id, wall]));
      current.visits = [...parsed.visits].sort((a, b) => b.at - a.at).slice(0, VISIT_LIMIT);
      current.settings = parsed.settings;
    },
  };

  return repo;
}
