import {createDefaultSettings, createSeedDevices} from './defaults';
import {parseDevice, parseSnapshot, serializeSnapshot} from './serialize';
import {SNAPSHOT_VERSION} from './types';

describe('serialize', () => {
  it('round-trips a full snapshot', () => {
    const devices = createSeedDevices(1);
    const snapshot = {
      version: SNAPSHOT_VERSION,
      devices,
      walls: [
        {
          id: 'wall-1',
          name: 'Двор',
          layout: '2x2' as const,
          dashboardLayout: '1+3' as const,
          deviceIds: [devices[0].id],
          onDashboard: true,
          createdAt: 1,
          updatedAt: 2,
        },
      ],
      visits: [
        {id: 'v1', at: 3, kind: 'app' as const, title: 'Открыли панель'},
      ],
      settings: createDefaultSettings(),
    };

    const parsed = parseSnapshot(serializeSnapshot(snapshot));
    expect(parsed).toEqual(snapshot);
  });

  it('rejects an unknown version', () => {
    expect(() => parseSnapshot(JSON.stringify({version: 99, devices: [], walls: [], visits: []}))).toThrow(
      /Unsupported snapshot version/,
    );
  });

  it('reads an older wall that only stored camera ids', () => {
    const parsed = parseSnapshot({
      version: SNAPSHOT_VERSION,
      devices: [],
      walls: [
        {
          id: 'wall-old',
          name: 'Двор',
          layout: 'custom',
          cameraIds: ['cam-1'],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      visits: [],
      settings: createDefaultSettings(),
    });
    expect(parsed.walls[0]).toMatchObject({deviceIds: ['cam-1'], onDashboard: false});
  });

  it('rejects a broken device', () => {
    expect(() => parseDevice({kind: 'camera', name: 'x'})).toThrow(/Invalid/);
  });
});
