import {classifyFrameChange, frameChangeBox} from './frameDiff';

describe('frameChangeBox', () => {
  it('outlines the region that actually moved', () => {
    const width = 8;
    const height = 4;
    const before = new Array(width * height).fill(20);
    const after = [...before];
    for (let y = 1; y <= 2; y += 1) {
      for (let x = 1; x <= 2; x += 1) {
        after[y * width + x] = 90;
      }
    }

    const box = frameChangeBox(before, after, width, height);
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x).toBeLessThan(0.2);
    expect(box!.x + box!.w).toBeLessThan(0.7);
    expect(box!.w).toBeGreaterThan(0.2);
  });

  it('ignores a single noisy cell', () => {
    const before = new Array(16).fill(10);
    const after = [...before];
    after[3] = 80;
    expect(frameChangeBox(before, after, 4, 4)).toBeNull();
  });
});

describe('classifyFrameChange', () => {
  const width = 32;
  const height = 18;

  it('treats a flat brightness shift as light, not an object', () => {
    const before = new Array(width * height).fill(90);
    const after = before.map((value) => value + 35);
    expect(classifyFrameChange(before, after, width, height).kind).not.toBe('object');
  });

  it('treats a cloud across the top of the frame as light', () => {
    const before = new Array(width * height).fill(80);
    const after = [...before];
    for (let y = 0; y < 11; y += 1) {
      for (let x = 0; x < width; x += 1) {
        after[y * width + x] = 40;
      }
    }
    expect(classifyFrameChange(before, after, width, height).kind).not.toBe('object');
  });

  it('treats scattered shadow speckles as light', () => {
    const before = new Array(width * height).fill(70);
    const after = [...before];
    for (let index = 0; index < after.length; index += 11) {
      after[index] = 20;
    }
    expect(classifyFrameChange(before, after, width, height).kind).not.toBe('object');
  });

  it('keeps a compact object', () => {
    const before = new Array(width * height).fill(60);
    const after = [...before];
    for (let y = 6; y <= 12; y += 1) {
      for (let x = 8; x <= 14; x += 1) {
        after[y * width + x] = 150;
      }
    }
    const verdict = classifyFrameChange(before, after, width, height);
    expect(verdict.kind).toBe('object');
    expect(verdict.box).not.toBeNull();
    expect(verdict.box!.x).toBeGreaterThan(0.1);
    expect(verdict.box!.x + verdict.box!.w).toBeLessThan(0.7);
  });
});