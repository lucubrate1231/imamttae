/**
 * 제철과 기록 (10/3 사용자 결정)
 * 사진은 작가가 '다녀온 계절' 그대로 보여 줍니다. 그래서 장면을 둘로 나눕니다.
 * - 제철(peak): 다녀온 달이 가장 좋은 때 안에 있는 장면. 가장 좋은 때 내내 강조해서 보여 줍니다.
 * - 기록(record): 그 밖의 장면. 철 지나 다녀온 곳, 일 년 내내 볼 수 있는 곳(일출·낙조·바다),
 *   가장 좋은 때가 없는 곳입니다. 다녀온 달에만 톤을 낮춰 보여 줍니다.
 */
import { inWindow, MONTHS, type Month, type MonthWindow } from './month';

export type SceneTier = 'peak' | 'record';

export interface TierInput {
  visited: string;
  best?: MonthWindow | null;
}

export function visitedMonth(visited: string): Month {
  const m = /^\d{4}-(\d{2})(?:-\d{2})?$/.exec(visited);
  if (!m) throw new Error(`다녀온 날 형식이 틀림: ${visited}`);
  const month = Number(m[1]);
  if (month < 1 || month > 12) throw new Error(`다녀온 날 형식이 틀림: ${visited}`);
  return month;
}

export function isYearRound(w: MonthWindow): boolean {
  return MONTHS.every((m) => inWindow(m, w));
}

export function sceneTier(s: TierInput): SceneTier {
  const b = s.best;
  if (!b || isYearRound(b)) return 'record';
  return inWindow(visitedMonth(s.visited), b) ? 'peak' : 'record';
}

/** 그 장면이 나오는 달(오름차순) */
export function monthsForScene(s: TierInput): Month[] {
  if (sceneTier(s) === 'peak') return MONTHS.filter((m) => inWindow(m, s.best!));
  return [visitedMonth(s.visited)];
}

/** 그달 화면에 나올 장면을 제철과 기록으로 나눕니다(들어온 순서 유지) */
export function splitByMonth<T extends TierInput>(scenes: readonly T[], month: Month): { peak: T[]; record: T[] } {
  const peak: T[] = [];
  const record: T[] = [];
  for (const sc of scenes) {
    if (!monthsForScene(sc).includes(month)) continue;
    (sceneTier(sc) === 'peak' ? peak : record).push(sc);
  }
  return { peak, record };
}
