import {
  createDefaultSettings,
  createId,
  createSeedDevices,
  parseDevice,
  parseSettings,
  parseSnapshot,
  parseVisit,
  parseWall,
  serializeDevice,
  serializeVisit,
  serializeWall,
  VISIT_LIMIT,
  type HomeAccount,
  type HomeRepository,
  type HomeSnapshot,
  type NetworkSettings,
  type NewVisit,
  type Visit,
  SNAPSHOT_VERSION,
} from '@smartosa/core';
import {
  ACTIVE_HOME_KEY,
  DEVICES_STORE,
  HOMES_STORE,
  SETTINGS_STORE,
  VISITS_STORE,
  WALLS_STORE,
  idbRequest,
  openHomeDb,
  type PayloadRecord,
} from './idb';

const NETWORK_KEY = 'network';

function scopeKey(homeId: string, id: string): string {
  return `${homeId}:${id}`;
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openHomeDb();
  const tx = db.transaction(storeName, 'readonly');
  const rows = await idbRequest(tx.objectStore(storeName).getAll() as IDBRequest<T[]>);
  db.close();
  return rows;
}

async function getAllPayloads(storeName: string): Promise<PayloadRecord[]> {
  return getAll<PayloadRecord>(storeName);
}

async function putPayload(storeName: string, record: PayloadRecord): Promise<void> {
  const db = await openHomeDb();
  const tx = db.transaction(storeName, 'readwrite');
  await idbRequest(tx.objectStore(storeName).put(record));
  db.close();
}

async function deletePayload(storeName: string, id: string): Promise<void> {
  const db = await openHomeDb();
  const tx = db.transaction(storeName, 'readwrite');
  await idbRequest(tx.objectStore(storeName).delete(id));
  db.close();
}

async function readActiveId(): Promise<string | null> {
  const db = await openHomeDb();
  const tx = db.transaction(SETTINGS_STORE, 'readonly');
  const row = await idbRequest(
    tx.objectStore(SETTINGS_STORE).get(ACTIVE_HOME_KEY) as IDBRequest<PayloadRecord | undefined>,
  );
  db.close();
  return row?.payload ?? null;
}

async function writeActiveId(homeId: string): Promise<void> {
  await putPayload(SETTINGS_STORE, {id: ACTIVE_HOME_KEY, payload: homeId, updatedAt: Date.now()});
}

async function listHomeRecords(): Promise<HomeAccount[]> {
  const homes = await getAll<HomeAccount>(HOMES_STORE);
  return homes.sort((a, b) => a.createdAt - b.createdAt);
}

export function createIndexedDbRepository(): HomeRepository {
  let catalogReady: Promise<void> | null = null;

  async function initCatalog(): Promise<void> {
    const homes = await listHomeRecords();
    const createdFirstHome = homes.length === 0;
    let homeId = createdFirstHome ? createId() : (await readActiveId()) ?? homes[0].id;
    if (createdFirstHome) {
      const now = Date.now();
      await putHome({id: homeId, name: 'Дом', createdAt: now, updatedAt: now});
    } else if (!homes.some((home) => home.id === homeId)) {
      homeId = homes[0].id;
    }
    await writeActiveId(homeId);
    await adoptUnscoped(homeId);
    if (createdFirstHome && (await scopedRows(DEVICES_STORE, homeId)).length === 0) {
      const now = Date.now();
      for (const device of createSeedDevices(now)) {
        await putPayload(DEVICES_STORE, {
          id: scopeKey(homeId, device.id),
          payload: serializeDevice(device),
          updatedAt: device.updatedAt,
        });
      }
    }
  }

  async function adoptUnscoped(homeId: string): Promise<void> {
    for (const storeName of [DEVICES_STORE, WALLS_STORE, VISITS_STORE]) {
      const rows = await getAllPayloads(storeName);
      for (const row of rows) {
        if (row.id.includes(':')) {
          continue;
        }
        await deletePayload(storeName, row.id);
        await putPayload(storeName, {...row, id: scopeKey(homeId, row.id)});
      }
    }
    const settings = await getAllPayloads(SETTINGS_STORE);
    for (const row of settings) {
      if (row.id !== NETWORK_KEY) {
        continue;
      }
      await deletePayload(SETTINGS_STORE, row.id);
      await putPayload(SETTINGS_STORE, {...row, id: scopeKey(homeId, NETWORK_KEY)});
    }
  }

  function ensureCatalog(): Promise<void> {
    catalogReady ??= initCatalog().catch((error: unknown) => {
      catalogReady = null;
      throw error;
    });
    return catalogReady;
  }

  async function requireActiveId(): Promise<string> {
    await ensureCatalog();
    const active = await readActiveId();
    if (!active) {
      throw new Error('Дом не выбран');
    }
    return active;
  }

  async function scopedRows(storeName: string, homeId: string): Promise<PayloadRecord[]> {
    const prefix = `${homeId}:`;
    const rows = await getAllPayloads(storeName);
    return rows.filter((row) => row.id.startsWith(prefix));
  }

  async function deleteScoped(storeName: string, homeId: string): Promise<void> {
    const rows = await scopedRows(storeName, homeId);
    await Promise.all(rows.map((row) => deletePayload(storeName, row.id)));
  }

  async function putHome(home: HomeAccount): Promise<void> {
    const db = await openHomeDb();
    const tx = db.transaction(HOMES_STORE, 'readwrite');
    await idbRequest(tx.objectStore(HOMES_STORE).put(home));
    db.close();
  }

  const repo: HomeRepository = {
    async listHomes() {
      await ensureCatalog();
      return listHomeRecords();
    },
    async activeHome() {
      const homeId = await requireActiveId();
      const home = (await listHomeRecords()).find((item) => item.id === homeId);
      if (!home) {
        throw new Error('Дом не найден');
      }
      return home;
    },
    async createHome(name) {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('Укажите название дома');
      }
      await ensureCatalog();
      const stamp = Date.now();
      const home: HomeAccount = {id: createId(), name: trimmed, createdAt: stamp, updatedAt: stamp};
      await putHome(home);
      await writeActiveId(home.id);
      return home;
    },
    async renameHome(id, name) {
      const trimmed = name.trim();
      if (!trimmed) {
        throw new Error('Укажите название дома');
      }
      await ensureCatalog();
      const home = (await listHomeRecords()).find((item) => item.id === id);
      if (!home) {
        throw new Error('Дом не найден');
      }
      const next = {...home, name: trimmed, updatedAt: Date.now()};
      await putHome(next);
      return next;
    },
    async deleteHome(id) {
      await ensureCatalog();
      const homes = await listHomeRecords();
      if (!homes.some((home) => home.id === id)) {
        throw new Error('Дом не найден');
      }
      if (homes.length <= 1) {
        throw new Error('Нельзя удалить единственный дом');
      }
      await deleteScoped(DEVICES_STORE, id);
      await deleteScoped(WALLS_STORE, id);
      await deleteScoped(VISITS_STORE, id);
      await deletePayload(SETTINGS_STORE, scopeKey(id, NETWORK_KEY));
      await deletePayload(HOMES_STORE, id);
      if ((await readActiveId()) === id) {
        const rest = homes.filter((home) => home.id !== id);
        await writeActiveId(rest[0].id);
      }
    },
    async switchHome(id) {
      await ensureCatalog();
      const home = (await listHomeRecords()).find((item) => item.id === id);
      if (!home) {
        throw new Error('Дом не найден');
      }
      await writeActiveId(home.id);
      return home;
    },
    async listDevices() {
      const homeId = await requireActiveId();
      const rows = await scopedRows(DEVICES_STORE, homeId);
      return rows.map((row) => parseDevice(JSON.parse(row.payload))).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async getDevice(id) {
      const homeId = await requireActiveId();
      const db = await openHomeDb();
      const tx = db.transaction(DEVICES_STORE, 'readonly');
      const row = await idbRequest(
        tx.objectStore(DEVICES_STORE).get(scopeKey(homeId, id)) as IDBRequest<PayloadRecord | undefined>,
      );
      db.close();
      return row ? parseDevice(JSON.parse(row.payload)) : null;
    },
    async upsertDevice(device) {
      const homeId = await requireActiveId();
      await putPayload(DEVICES_STORE, {
        id: scopeKey(homeId, device.id),
        payload: serializeDevice(device),
        updatedAt: device.updatedAt,
      });
      return device;
    },
    async deleteDevice(id) {
      const homeId = await requireActiveId();
      await deletePayload(DEVICES_STORE, scopeKey(homeId, id));
      const walls = await repo.listWalls();
      await Promise.all(
        walls
          .filter((wall) => wall.deviceIds.includes(id))
          .map((wall) =>
            repo.upsertWall({
              ...wall,
              deviceIds: wall.deviceIds.filter((deviceId) => deviceId !== id),
              updatedAt: Date.now(),
            }),
          ),
      );
    },
    async listWalls() {
      const homeId = await requireActiveId();
      const rows = await scopedRows(WALLS_STORE, homeId);
      return rows.map((row) => parseWall(JSON.parse(row.payload))).sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async getWall(id) {
      const homeId = await requireActiveId();
      const db = await openHomeDb();
      const tx = db.transaction(WALLS_STORE, 'readonly');
      const row = await idbRequest(
        tx.objectStore(WALLS_STORE).get(scopeKey(homeId, id)) as IDBRequest<PayloadRecord | undefined>,
      );
      db.close();
      return row ? parseWall(JSON.parse(row.payload)) : null;
    },
    async upsertWall(wall) {
      const homeId = await requireActiveId();
      await putPayload(WALLS_STORE, {
        id: scopeKey(homeId, wall.id),
        payload: serializeWall(wall),
        updatedAt: wall.updatedAt,
      });
      return wall;
    },
    async deleteWall(id) {
      const homeId = await requireActiveId();
      await deletePayload(WALLS_STORE, scopeKey(homeId, id));
    },
    async listVisits(limit = 20) {
      const homeId = await requireActiveId();
      const rows = await scopedRows(VISITS_STORE, homeId);
      return rows
        .map((row) => parseVisit(JSON.parse(row.payload)))
        .sort((a, b) => b.at - a.at)
        .slice(0, limit);
    },
    async logVisit(input: NewVisit) {
      const homeId = await requireActiveId();
      const visit: Visit = {
        id: input.id ?? createId(),
        at: input.at,
        kind: input.kind,
        targetId: input.targetId,
        title: input.title,
      };
      await putPayload(VISITS_STORE, {
        id: scopeKey(homeId, visit.id),
        payload: serializeVisit(visit),
        updatedAt: visit.at,
      });
      const extras = (await repo.listVisits(VISIT_LIMIT + 50)).slice(VISIT_LIMIT);
      await Promise.all(extras.map((item) => deletePayload(VISITS_STORE, scopeKey(homeId, item.id))));
      return visit;
    },
    async getSettings() {
      const homeId = await requireActiveId();
      const db = await openHomeDb();
      const tx = db.transaction(SETTINGS_STORE, 'readonly');
      const row = await idbRequest(
        tx.objectStore(SETTINGS_STORE).get(scopeKey(homeId, NETWORK_KEY)) as IDBRequest<PayloadRecord | undefined>,
      );
      db.close();
      return row ? parseSettings(JSON.parse(row.payload)) : createDefaultSettings();
    },
    async setSettings(settings: NetworkSettings) {
      const homeId = await requireActiveId();
      await putPayload(SETTINGS_STORE, {
        id: scopeKey(homeId, NETWORK_KEY),
        payload: JSON.stringify(settings),
        updatedAt: Date.now(),
      });
      return settings;
    },
    async exportSnapshot() {
      await requireActiveId();
      const [devices, walls, visits, settings] = await Promise.all([
        repo.listDevices(),
        repo.listWalls(),
        repo.listVisits(VISIT_LIMIT),
        repo.getSettings(),
      ]);
      return {version: SNAPSHOT_VERSION, devices, walls, visits, settings};
    },
    async importSnapshot(snapshot: HomeSnapshot) {
      const homeId = await requireActiveId();
      const parsed = parseSnapshot(snapshot);
      await deleteScoped(DEVICES_STORE, homeId);
      await deleteScoped(WALLS_STORE, homeId);
      await deleteScoped(VISITS_STORE, homeId);
      for (const device of parsed.devices) {
        await putPayload(DEVICES_STORE, {
          id: scopeKey(homeId, device.id),
          payload: serializeDevice(device),
          updatedAt: device.updatedAt,
        });
      }
      for (const wall of parsed.walls) {
        await putPayload(WALLS_STORE, {
          id: scopeKey(homeId, wall.id),
          payload: serializeWall(wall),
          updatedAt: wall.updatedAt,
        });
      }
      for (const visit of parsed.visits) {
        await putPayload(VISITS_STORE, {
          id: scopeKey(homeId, visit.id),
          payload: serializeVisit(visit),
          updatedAt: visit.at,
        });
      }
      await repo.setSettings(parsed.settings);
    },
  };

  return repo;
}
