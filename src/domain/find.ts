/** 풍경·권역 고르기와 정렬. 화면 없이 실행하는 계산입니다. */
import { inWindow, MONTHS, type Month } from './month';
import { monthsForScene, sceneTier, visitedMonth, type TierInput } from './sceneTier';
import { SCENE_TYPES, type SceneTypeId } from './sceneTypes';

export type RegionId = 'gangwon' | 'gyeongsang' | 'jeolla' | 'chungcheong' | 'sudogwon';

export const REGIONS: readonly { id: RegionId; label: string }[] = [
  { id: 'gangwon', label: '강원' },
  { id: 'gyeongsang', label: '경상' },
  { id: 'jeolla', label: '전라' },
  { id: 'chungcheong', label: '충청' },
  { id: 'sudogwon', label: '수도권' },
];

const REGION_BY_PREFIX: ReadonlyMap<string, RegionId> = new Map([
  ['강원', 'gangwon'],
  ['경북', 'gyeongsang'], ['경남', 'gyeongsang'], ['부산', 'gyeongsang'], ['대구', 'gyeongsang'], ['울산', 'gyeongsang'],
  ['전북', 'jeolla'], ['전남', 'jeolla'], ['광주', 'jeolla'],
  ['충북', 'chungcheong'], ['충남', 'chungcheong'], ['대전', 'chungcheong'], ['세종', 'chungcheong'],
  ['서울', 'sudogwon'], ['경기', 'sudogwon'], ['인천', 'sudogwon'],
]);

export interface FindInput extends TierInput {
  kind: string;
  hidden?: boolean;
  region: string;
  types: readonly SceneTypeId[];
  name: string;
}

/** 지역의 첫 낱말로 권역을 정합니다. 모르는 지역은 null입니다. */
export function regionOf(region: string): RegionId | null {
  return REGION_BY_PREFIX.get(region.trim().split(/\s+/)[0] ?? '') ?? null;
}

function isVisibleStory(scene: FindInput): boolean {
  return scene.kind === 'story' && scene.hidden !== true;
}

/** 장면이 있는 권역만 칩 순서대로, 공개 이야기 수와 함께 돌려줍니다. */
export function regionCounts(scenes: readonly FindInput[]): { id: RegionId; label: string; count: number }[] {
  const counts = new Map<RegionId, number>();
  for (const scene of scenes) {
    if (!isVisibleStory(scene)) continue;
    const region = regionOf(scene.region);
    if (region) counts.set(region, (counts.get(region) ?? 0) + 1);
  }
  return REGIONS.map((region) => ({ ...region, count: counts.get(region.id) ?? 0 })).filter((region) => region.count > 0);
}

/** 이야기 없는 풍경도 0을 넣어, 13가지 모두의 이야기 수를 돌려줍니다. */
export function typeCounts(scenes: readonly FindInput[]): Record<SceneTypeId, number> {
  const counts = Object.fromEntries(SCENE_TYPES.map(({ id }) => [id, 0])) as Record<SceneTypeId, number>;
  for (const scene of scenes) {
    if (!isVisibleStory(scene)) continue;
    for (const type of new Set(scene.types)) counts[type]++;
  }
  return counts;
}

/** 제철은 추천 기간, 그 밖은 다녀온 달을 모아 오름차순으로 표시합니다. */
export function monthsForType(scenes: readonly FindInput[], type: SceneTypeId): Month[] {
  const months = new Set<Month>();
  for (const scene of scenes) {
    if (!isVisibleStory(scene) || !scene.types.includes(type)) continue;
    for (const month of monthsForScene(scene)) months.add(month);
  }
  return MONTHS.filter((month) => months.has(month));
}

function monthsUntil(from: Month, to: Month): number {
  return (to - from + MONTHS.length) % MONTHS.length;
}

/** 달로 장면을 빼지 않고, 선택한 달부터 가까운 순서로 두 갈래를 정렬합니다. */
export function findScenes<T extends FindInput>(
  scenes: readonly T[],
  opts: { type?: SceneTypeId | null; region?: RegionId | null; month: Month },
): { peak: T[]; record: T[] } {
  const peak: T[] = [];
  const record: T[] = [];
  for (const scene of scenes) {
    if (!isVisibleStory(scene)) continue;
    if (opts.type && !scene.types.includes(opts.type)) continue;
    if (opts.region && regionOf(scene.region) !== opts.region) continue;
    (sceneTier(scene) === 'peak' ? peak : record).push(scene);
  }

  // peak로 나뉜 장면에는 반드시 추천 기간이 있습니다(sceneTier의 기존 규칙).
  const peakDistance = (scene: T) => inWindow(opts.month, scene.best!) ? 0 : monthsUntil(opts.month, scene.best!.from);
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'ko');
  peak.sort((a, b) => peakDistance(a) - peakDistance(b) || byName(a, b));
  record.sort((a, b) => monthsUntil(opts.month, visitedMonth(a.visited)) - monthsUntil(opts.month, visitedMonth(b.visited)) || byName(a, b));
  return { peak, record };
}
