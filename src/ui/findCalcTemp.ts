/**
 * ⚠ 임시 계산 — Codex 일 3(docs/tasks/codex-3-풍경찾기-묶음-계산.md)이 합쳐지면 지웁니다.
 * 풍경 찾기 화면을 먼저 보여 드리려고(10/4 사용자 요청), 일 3 작업 문서의 함수 이름·주고받는 값 그대로 화면 쪽에 둡니다.
 * 일 3이 합쳐지면: src/ui/find.ts의 import를 '../domain/find'로 바꾸고 이 파일을 지웁니다(화면 테스트는 그대로).
 * 규칙의 원본은 docs/features/F3-풍경-찾기.md '계산에 쓰는 말'(D16·D17·D22·D23).
 */
import type { FindInput } from '../domain/find';
import { inWindow, MONTHS, type Month } from '../domain/month';
import { isYearRound } from '../domain/sceneTier';
import { SCENE_TYPES, type SceneTypeId } from '../domain/sceneTypes';

export type TypeWhen = { kind: 'always' } | { kind: 'range'; from: Month; to: Month } | { kind: 'none' };

export interface TypeGroups {
  good: { type: SceneTypeId; count: number }[];
  always: SceneTypeId[];
  other: SceneTypeId[];
  empty: SceneTypeId[];
}

const visible = (s: FindInput) => s.kind === 'story' && !s.hidden;
const ofType = (scenes: readonly FindInput[], type: SceneTypeId) => scenes.filter((s) => visible(s) && s.types.includes(type));
const yearRound = (s: FindInput) => !!s.best && isYearRound(s.best);
const next = (m: Month, k = 1): Month => ((m - 1 + k) % 12) + 1;
/** from에서 to까지 몇 달 뒤인가(0~11) */
const ahead = (from: Month, to: Month) => (to - from + 12) % 12;

/** 볼 수 있는 때(D16·D17) */
export function typeWhen(scenes: readonly FindInput[], type: SceneTypeId): TypeWhen {
  const list = ofType(scenes, type);
  if (list.length > 0 && list.filter(yearRound).length * 2 > list.length) return { kind: 'always' };
  const timed = list.filter((s) => s.best && !yearRound(s));
  const months = new Set<Month>();
  for (const s of timed) for (const m of MONTHS) if (inWindow(m, s.best!)) months.add(m);
  if (months.size === 0) return { kind: 'none' };
  if (months.size === 12) return { kind: 'always' };
  // 이어진 달 묶음(해를 넘는 것 포함)으로 나눔
  const runs: { from: Month; to: Month; len: number }[] = [];
  for (const m of MONTHS) {
    if (!months.has(m) || months.has(next(m, 11))) continue; // 묶음의 시작 달만
    let len = 1;
    while (months.has(next(m, len))) len++;
    runs.push({ from: m, to: next(m, len - 1), len });
  }
  const hits = (r: { from: Month; to: Month }) => timed.filter((s) => MONTHS.some((m) => inWindow(m, s.best!) && inWindow(m, r))).length;
  runs.sort((a, b) => hits(b) - hits(a) || b.len - a.len || a.from - b.from);
  const r = runs[0]!;
  return { kind: 'range', from: r.from, to: r.to };
}

/** 이번 달과 볼 수 있는 때의 관계 */
export function whenStatus(w: TypeWhen, month: Month): 'now' | 'soon' | 'later' | 'always' | 'none' {
  if (w.kind !== 'range') return w.kind;
  if (inWindow(month, w)) return 'now';
  return next(month) === w.from ? 'soon' : 'later';
}

/** 고르기 화면 묶음(D22) */
export function typeGroups(scenes: readonly FindInput[], month: Month): TypeGroups {
  const g: TypeGroups = { good: [], always: [], other: [], empty: [] };
  const otherWhen: { type: SceneTypeId; w: TypeWhen; i: number }[] = [];
  SCENE_TYPES.forEach(({ id }, i) => {
    const list = ofType(scenes, id);
    if (list.length === 0) return g.empty.push(id);
    const w = typeWhen(scenes, id);
    if (w.kind === 'always') return g.always.push(id);
    const count = list.filter((s) => s.best && !yearRound(s) && inWindow(month, s.best)).length;
    if (count > 0) return g.good.push({ type: id, count });
    otherWhen.push({ type: id, w, i });
  });
  const order = (t: SceneTypeId) => SCENE_TYPES.findIndex((x) => x.id === t);
  g.good.sort((a, b) => b.count - a.count || order(a.type) - order(b.type));
  const startIn = (x: { w: TypeWhen }) => (x.w.kind === 'range' ? ahead(next(month), x.w.from) : 99);
  g.other = otherWhen.sort((a, b) => startIn(a) - startIn(b) || a.i - b.i).map((x) => x.type);
  return g;
}

/** D23: '지금 제철' 묶음 안에서는 추천 시기가 먼저 끝나는 곳 먼저, 같으면 이름순(일 3에서 findScenes가 맡음) */
export function sortNowGroup<T extends FindInput>(list: readonly T[], month: Month): T[] {
  const left = (s: T) => ahead(month, s.best!.to);
  return [...list].sort((a, b) => left(a) - left(b) || a.name.localeCompare(b.name, 'ko'));
}
