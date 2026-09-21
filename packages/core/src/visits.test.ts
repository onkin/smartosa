import {popularTargets} from './visits';

describe('popularTargets', () => {
  it('ranks devices and walls by how often they were opened', () => {
    const ranked = popularTargets([
      {id: '1', at: 10, kind: 'device', targetId: 'cam', title: 'Старое имя'},
      {id: '2', at: 30, kind: 'device', targetId: 'cam', title: 'Гараж'},
      {id: '3', at: 20, kind: 'wall', targetId: 'yard', title: 'Двор'},
      {id: '4', at: 40, kind: 'app', title: 'Панель'},
      {id: '5', at: 50, kind: 'device', title: 'Без цели'},
    ]);
    expect(ranked).toEqual([
      {kind: 'device', targetId: 'cam', title: 'Гараж', count: 2, lastAt: 30},
      {kind: 'wall', targetId: 'yard', title: 'Двор', count: 1, lastAt: 20},
    ]);
  });
});
