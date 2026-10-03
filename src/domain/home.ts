/**
 * 첫 화면 계산 — 무엇을 어떤 순서로 보여 줄지(docs/features/F1-지금-볼-만한-곳.md)
 * 화면 없는 순수 함수만 둡니다. 기능 ①에 필요한 계산이라 Claude가 맡습니다(AGENTS.md 예외).
 */
import type { PlaceholderScene, Scene, StoryScene } from '../../shared/schema/content';
import { inWindow, type Month } from './month';
import { isYearRound, splitByMonth, visitedMonth } from './sceneTier';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** 달 → 계절(F1-AC12). 3~5 봄, 6~8 여름, 9~11 가을, 12~2 겨울 */
export function seasonOf(m: Month): Season {
  if (m >= 3 && m <= 5) return 'spring';
  if (m >= 6 && m <= 8) return 'summer';
  if (m >= 9 && m <= 11) return 'autumn';
  return 'winter';
}

export interface HomeView {
  /** 제철 카드(정한 순서) */
  peak: StoryScene[];
  /** 작가 부부가 다녀온 곳(제철 아님, 다녀온 달에만) */
  record: StoryScene[];
  /** 그달에 다녀온 준비 중 장면(카드 띠 맨 뒤) */
  placeholders: PlaceholderScene[];
  /** 이야기가 하나도 없는 달인가(F1-AC8) */
  empty: boolean;
  /** 빈 달일 때 대신 보여 줄 가까운 달과 그 달들의 제철 풍경 */
  nearby: { months: Month[]; peak: StoryScene[] };
}

/** 두 달 사이 거리(해를 넘어 가까운 쪽) */
function monthGap(a: Month, b: Month): number {
  const d = Math.abs(a - b);
  return Math.min(d, 12 - d);
}

/** 고른 달부터 가장 좋은 때가 끝나기까지 남은 달 수(고른 달 포함). 적을수록 '지금 아니면 못 보는 곳' */
function monthsLeft(s: StoryScene, m: Month): number {
  let k = 0;
  while (k < 12 && inWindow(((m - 1 + k) % 12) + 1, s.best!)) k++;
  return k;
}

/**
 * F1-AC3 제철 순서: ① 사진을 바로 그달에 찍은 곳 → ② 찍은 달이 가까운 곳 → ③ 가장 좋은 때가 곧 끝나는 곳.
 * 그래도 같으면 최근에 다녀온 곳, 그것도 같으면 데이터에 적힌 순서(확정 시안 v2와 같음).
 */
function orderPeak(scenes: readonly StoryScene[], m: Month): StoryScene[] {
  return [...scenes].sort(
    (a, b) =>
      monthGap(visitedMonth(a.visited), m) - monthGap(visitedMonth(b.visited), m) ||
      monthsLeft(a, m) - monthsLeft(b, m) ||
      b.visited.localeCompare(a.visited),
  );
}

function storiesOf(scenes: readonly Scene[]): StoryScene[] {
  return scenes.filter((s): s is StoryScene => s.kind === 'story' && !s.hidden);
}

export function homeView(scenes: readonly Scene[], month: Month): HomeView {
  const stories = storiesOf(scenes);
  const split = (m: Month) => splitByMonth(stories, m);
  const { peak, record } = split(month);
  const placeholders = scenes.filter((s): s is PlaceholderScene => s.kind === 'placeholder' && visitedMonth(s.visited) === month);
  const empty = peak.length + record.length + placeholders.length === 0;

  // F1-AC8: 빈 달이면 앞뒤로 가장 가까운 달(같은 거리면 둘 다)의 제철 풍경
  const nearby: HomeView['nearby'] = { months: [], peak: [] };
  if (empty) {
    for (let d = 1; d <= 6 && nearby.months.length === 0; d++) {
      for (const m of [((month - 1 - d + 12) % 12) + 1, ((month - 1 + d) % 12) + 1]) {
        if (!nearby.months.includes(m) && split(m).peak.length > 0) nearby.months.push(m);
      }
    }
    for (const m of nearby.months) nearby.peak.push(...orderPeak(split(m).peak, m).filter((s) => !nearby.peak.includes(s)));
  }

  return { peak: orderPeak(peak, month), record, placeholders, empty, nearby };
}

/** 오늘 기준 제철 판단(장면 상세 꼬리표, 10/4 결정). 첫 화면에서 고른 달이 아니라 '오늘'(한국 날짜)이 기준 */
export type SeasonNow = 'now' | 'off' | 'yearRound' | 'none';

export function seasonNow(best: { from: Month; to: Month } | undefined | null, today: Month): SeasonNow {
  if (!best) return 'none';
  if (isYearRound(best)) return 'yearRound';
  return inWindow(today, best) ? 'now' : 'off';
}
