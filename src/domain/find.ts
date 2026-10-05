/** 풍경·권역 고르기와 정렬. 화면 없이 실행하는 계산입니다. */
import { inWindow, MONTHS, type Month, type MonthWindow } from './month';
import { isYearRound, sceneTier, visitedMonth, type TierInput } from './sceneTier';
import { SCENE_TYPES, type SceneTypeId } from './sceneTypes';

export type RegionId = 'gangwon' | 'gyeongsang' | 'jeolla' | 'chungcheong' | 'sudogwon' | 'jeju';

export const REGIONS: readonly { id: RegionId; label: string }[] = [
  { id: 'gangwon', label: '강원' },
  { id: 'gyeongsang', label: '경상' },
  { id: 'jeolla', label: '전라' },
  { id: 'chungcheong', label: '충청' },
  { id: 'sudogwon', label: '수도권' },
  { id: 'jeju', label: '제주' }, // 디자인 #55: 장면이 생기면 칩이 저절로 나옴
];

const REGION_BY_PREFIX: ReadonlyMap<string, RegionId> = new Map([
  ['강원', 'gangwon'],
  ['경북', 'gyeongsang'], ['경남', 'gyeongsang'], ['부산', 'gyeongsang'], ['대구', 'gyeongsang'], ['울산', 'gyeongsang'],
  ['전북', 'jeolla'], ['전남', 'jeolla'], ['광주', 'jeolla'],
  ['충북', 'chungcheong'], ['충남', 'chungcheong'], ['대전', 'chungcheong'], ['세종', 'chungcheong'],
  ['서울', 'sudogwon'], ['경기', 'sudogwon'], ['인천', 'sudogwon'],
  ['제주', 'jeju'], ['서귀포', 'jeju'],
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

export type TypeWhen =
  | { kind: 'always' }
  | { kind: 'range'; from: Month; to: Month }
  | { kind: 'none' };

/** 다녀온 달 대신 추천 시기를 합쳐 풍경의 볼 수 있는 때를 정합니다. */
export function typeWhen(scenes: readonly FindInput[], type: SceneTypeId): TypeWhen {
  const stories = scenes.filter((scene) => isVisibleStory(scene) && scene.types.includes(type));
  const yearRound = stories.filter((scene) => scene.best && isYearRound(scene.best)).length;
  if (yearRound > stories.length / 2) return { kind: 'always' };
  const windows = stories.map((scene) => scene.best)
    .filter((best): best is MonthWindow => !!best && !isYearRound(best));
  const months = new Set(MONTHS.filter((month) => windows.some((best) => inWindow(month, best))));
  if (months.size === MONTHS.length) return { kind: 'always' };
  if (months.size === 0) return { kind: 'none' };

  // 1월과 12월도 이어지는 한 범위로 셉니다.
  const ranges = MONTHS.filter((month) => months.has(month) && !months.has(month === 1 ? 12 : month - 1))
    .map((from) => {
      let to = from;
      let length = 1;
      while (months.has(to === 12 ? 1 : to + 1)) {
        to = to === 12 ? 1 : to + 1; length++;
      }
      const count = windows.filter((best) => MONTHS.some((month) => inWindow(month, { from, to }) && inWindow(month, best))).length;
      return { from, to, length, count };
    });
  ranges.sort((a, b) => b.count - a.count || b.length - a.length || a.from - b.from);
  const { from, to } = ranges[0]!;
  return { kind: 'range', from, to };
}

/** 이번 달이 범위 안인지, 다음 달에 시작하는지 알려 줍니다. */
export function whenStatus(w: TypeWhen, month: Month): 'now' | 'soon' | 'later' | 'always' | 'none' {
  if (w.kind !== 'range') return w.kind;
  if (inWindow(month, w)) return 'now';
  return monthsUntil(month, w.from) === 1 ? 'soon' : 'later';
}

export interface TypeGroups {
  good: { type: SceneTypeId; count: number }[];
  always: SceneTypeId[];
  other: SceneTypeId[];
  empty: SceneTypeId[];
}

/** 고르기 화면의 좋은 때·언제나·다른 때·이야기 없는 풍경을 나눕니다. */
export function typeGroups(scenes: readonly FindInput[], month: Month): TypeGroups {
  const stories = scenes.filter(isVisibleStory);
  const groups: TypeGroups = { good: [], always: [], other: [], empty: [] };
  const other: { type: SceneTypeId; distance: number }[] = [];
  // 표 순서로 넣고 안정 정렬하여 같은 수·같은 시작 달이면 표 순서를 지킵니다.
  for (const { id: type } of SCENE_TYPES) {
    const matching = stories.filter((scene) => scene.types.includes(type));
    if (!matching.length) { groups.empty.push(type); continue; }
    const w = typeWhen(matching, type);
    if (w.kind === 'always') { groups.always.push(type); continue; }
    const count = matching.filter((scene) => scene.best && !isYearRound(scene.best) && inWindow(month, scene.best)).length;
    if (count) groups.good.push({ type, count });
    else other.push({ type, distance: w.kind === 'range' ? monthsUntil(month, w.from) : MONTHS.length });
  }
  groups.good.sort((a, b) => b.count - a.count);
  groups.other = other.sort((a, b) => a.distance - b.distance).map((row) => row.type);
  return groups;
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
  peak.sort((a, b) => {
    const distance = peakDistance(a) - peakDistance(b);
    if (distance) return distance;
    if (inWindow(opts.month, a.best!) && inWindow(opts.month, b.best!)) {
      const until = monthsUntil(opts.month, a.best!.to) - monthsUntil(opts.month, b.best!.to);
      if (until) return until;
    }
    return byName(a, b);
  });
  record.sort((a, b) => monthsUntil(opts.month, visitedMonth(a.visited)) - monthsUntil(opts.month, visitedMonth(b.visited)) || byName(a, b));
  return { peak, record };
}
