export const FRAME_DIFF_WIDTH = 32;
export const FRAME_DIFF_HEIGHT = 18;

export type FrameBox = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FrameChangeKind = 'none' | 'light' | 'object';

const BLUR_RADIUS = 2;
const STRUCTURE_CELL = 24;
const MIN_OBJECT_CELLS = 6;
const MAX_OBJECT_AREA = 0.3;
const MAX_OBJECT_SPAN = 0.62;

export function classifyFrameChange(
  before: number[],
  after: number[],
  width = FRAME_DIFF_WIDTH,
  height = FRAME_DIFF_HEIGHT,
): {box: FrameBox | null; kind: FrameChangeKind} {
  const count = width * height;
  if (width < 1 || height < 1 || before.length < count || after.length < count) {
    return {kind: 'none', box: null};
  }
  const left = highPass(before, width, height);
  const right = highPass(after, width, height);
  const diff = new Array<number>(count);
  let sum = 0;
  for (let index = 0; index < count; index += 1) {
    diff[index] = Math.abs(left[index] - right[index]);
    sum += diff[index];
  }
  const region = dominantRegion(diff, width, height, STRUCTURE_CELL);
  if (!region) {
    return {kind: sum / count >= 8 ? 'light' : 'none', box: null};
  }
  const area = region.box.w * region.box.h;
  const broad =
    area >= MAX_OBJECT_AREA || region.box.w >= MAX_OBJECT_SPAN || region.box.h >= MAX_OBJECT_SPAN;
  const speckled = region.size < MIN_OBJECT_CELLS || region.score < region.total * 0.55;
  if (broad || speckled) {
    return {kind: 'light', box: null};
  }
  return {kind: 'object', box: region.box};
}

function highPass(source: number[], width: number, height: number): number[] {
  const blurred = boxBlur(source, width, height, BLUR_RADIUS);
  return source.map((value, index) => value - blurred[index]);
}

function boxBlur(source: number[], width: number, height: number, radius: number): number[] {
  const output = new Array<number>(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sum = 0;
      let samples = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const nextY = y + dy;
        if (nextY < 0 || nextY >= height) {
          continue;
        }
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nextX = x + dx;
          if (nextX < 0 || nextX >= width) {
            continue;
          }
          sum += source[nextY * width + nextX];
          samples += 1;
        }
      }
      output[y * width + x] = sum / samples;
    }
  }
  return output;
}

export function frameChangeBox(
  before: number[],
  after: number[],
  width = FRAME_DIFF_WIDTH,
  height = FRAME_DIFF_HEIGHT,
): FrameBox | null {
  const count = width * height;
  if (width < 1 || height < 1 || before.length < count || after.length < count) {
    return null;
  }
  const diff = new Array<number>(count);
  for (let index = 0; index < count; index += 1) {
    diff[index] = Math.abs(before[index] - after[index]);
  }
  const clustered = largestBox(diff, width, height, 36) ?? largestBox(diff, width, height, 22);
  if (clustered) {
    return clustered.box;
  }
  let sum = 0;
  for (const value of diff) {
    sum += value;
  }
  if (sum / count >= 16) {
    return {x: 0, y: 0, w: 1, h: 1};
  }
  return null;
}

function dominantRegion(
  diff: number[],
  width: number,
  height: number,
  threshold: number,
): {box: FrameBox; score: number; size: number; total: number} | null {
  const found = largestBox(diff, width, height, threshold);
  if (!found) {
    return null;
  }
  return found;
}

function largestBox(
  diff: number[],
  width: number,
  height: number,
  threshold: number,
): {box: FrameBox; score: number; size: number; total: number} | null {
  const mask = new Uint8Array(diff.length);
  let marked = 0;
  let total = 0;
  for (let index = 0; index < diff.length; index += 1) {
    if (diff[index] >= threshold) {
      mask[index] = 1;
      marked += 1;
      total += diff[index];
    }
  }
  if (marked < 2) {
    return null;
  }

  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  let bestScore = 0;
  let best: {maxX: number; maxY: number; minX: number; minY: number; size: number} | null = null;

  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || seen[start]) {
      continue;
    }
    stack.push(start);
    seen[start] = 1;
    let score = 0;
    let size = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    while (stack.length > 0) {
      const index = stack.pop() as number;
      const x = index % width;
      const y = (index - x) / width;
      score += diff[index];
      size += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x > 0) {
        push(index - 1);
      }
      if (x + 1 < width) {
        push(index + 1);
      }
      if (y > 0) {
        push(index - width);
      }
      if (y + 1 < height) {
        push(index + width);
      }
    }
    if (size >= 2 && score > bestScore) {
      bestScore = score;
      best = {minX, minY, maxX, maxY, size};
    }
  }

  if (!best) {
    return null;
  }

  const minX = Math.max(0, best.minX - 1);
  const minY = Math.max(0, best.minY - 1);
  const maxX = Math.min(width - 1, best.maxX + 1);
  const maxY = Math.min(height - 1, best.maxY + 1);
  return {
    box: visibleBox({
      x: minX / width,
      y: minY / height,
      w: (maxX - minX + 1) / width,
      h: (maxY - minY + 1) / height,
    }),
    score: bestScore,
    size: best.size,
    total,
  };

  function push(index: number) {
    if (mask[index] && !seen[index]) {
      seen[index] = 1;
      stack.push(index);
    }
  }
}

function visibleBox(box: FrameBox): FrameBox {
  const min = 0.12;
  let {x, y, w, h} = box;
  if (w < min) {
    const center = x + w / 2;
    w = min;
    x = Math.max(0, Math.min(1 - w, center - w / 2));
  }
  if (h < min) {
    const center = y + h / 2;
    h = min;
    y = Math.max(0, Math.min(1 - h, center - h / 2));
  }
  return {x, y, w, h};
}
