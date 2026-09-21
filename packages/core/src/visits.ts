import type {Visit} from './types';

export type PopularTarget = {
  kind: 'device' | 'wall';
  targetId: string;
  title: string;
  count: number;
  lastAt: number;
};

export function popularTargets(visits: Visit[], limit = 8): PopularTarget[] {
  const totals = new Map<string, PopularTarget>();
  for (const visit of visits) {
    if ((visit.kind !== 'device' && visit.kind !== 'wall') || !visit.targetId) {
      continue;
    }
    const key = `${visit.kind}:${visit.targetId}`;
    const current = totals.get(key);
    if (current) {
      current.count += 1;
      if (visit.at >= current.lastAt) {
        current.lastAt = visit.at;
        current.title = visit.title;
      }
      continue;
    }
    totals.set(key, {
      kind: visit.kind,
      targetId: visit.targetId,
      title: visit.title,
      count: 1,
      lastAt: visit.at,
    });
  }
  return [...totals.values()]
    .sort((left, right) => right.count - left.count || right.lastAt - left.lastAt)
    .slice(0, limit);
}
