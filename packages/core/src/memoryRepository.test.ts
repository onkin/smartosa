import {createMemoryRepository} from './memoryRepository';
import {parseSnapshot, serializeSnapshot} from './serialize';

describe('memory repository', () => {
  it('seeds the first ONVIF camera and supports CRUD + export/import', async () => {
    const repo = createMemoryRepository({now: () => 10});
    const devices = await repo.listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].kind).toBe('camera');
    if (devices[0].kind === 'camera') {
      expect(devices[0].onvifPort).toBe(13554);
    }

    const iframe = await repo.upsertDevice({
      id: 'bat-1',
      kind: 'iframe',
      name: 'АКБ',
      url: 'http://{lan}/',
      createdAt: 11,
      updatedAt: 11,
    });
    expect((await repo.listDevices()).map((item) => item.id)).toContain(iframe.id);

    await repo.logVisit({at: 12, kind: 'device', targetId: iframe.id, title: iframe.name});
    expect((await repo.listVisits(5))[0].title).toBe('АКБ');

    const wall = await repo.upsertWall({
      id: 'wall-1',
      name: 'Все камеры',
      layout: '2x2',
      deviceIds: [devices[0].id],
      onDashboard: false,
      createdAt: 13,
      updatedAt: 13,
    });
    expect((await repo.getWall(wall.id))?.name).toBe('Все камеры');

    await repo.setSettings({lanHost: '10.0.0.1', wanHost: '1.2.3.4', go2rtcUrl: 'http://127.0.0.1:1984'});
    const snapshot = await repo.exportSnapshot();
    expect(snapshot.settings.lanHost).toBe('10.0.0.1');

    const clone = createMemoryRepository({seed: false});
    await clone.importSnapshot(parseSnapshot(serializeSnapshot(snapshot)));
    expect((await clone.listDevices()).map((item) => item.id).sort()).toEqual(
      [devices[0].id, iframe.id].sort(),
    );
    expect((await clone.getSettings()).wanHost).toBe('1.2.3.4');

    await repo.deleteDevice(devices[0].id);
    expect((await repo.getWall(wall.id))?.deviceIds).toEqual([]);
  });

  it('keeps cameras and network settings inside the active home', async () => {
    const repo = createMemoryRepository({seed: false, now: () => 10});
    await repo.upsertDevice({
      id: 'cam-a',
      kind: 'link',
      name: 'Дача',
      url: 'http://a',
      createdAt: 1,
      updatedAt: 1,
    });
    await repo.setSettings({lanHost: '10.0.0.1', wanHost: '1.1.1.1', go2rtcUrl: 'http://127.0.0.1:1984'});

    const second = await repo.createHome('Квартира');
    expect((await repo.activeHome()).id).toBe(second.id);
    expect(await repo.listDevices()).toEqual([]);
    expect((await repo.getSettings()).lanHost).toBe('');

    await repo.switchHome('home-default');
    expect((await repo.listDevices()).map((item) => item.id)).toEqual(['cam-a']);
    expect((await repo.getSettings()).lanHost).toBe('10.0.0.1');

    await expect(repo.deleteHome('home-default')).resolves.toBeUndefined();
    await expect(repo.deleteHome(second.id)).rejects.toThrow(/единственный/);
  });
});
