/**
 * ⚠ 임시 저장·계산 — Codex 일 4(docs/tasks/codex-4-저장한곳-저장.md)가 합쳐지면 지웁니다.
 * 저장한 곳 화면을 Codex 일과 동시에 만들려고(10/4 사용자 "저장한 곳 시작해"), 일 4의 함수 이름·주고받는 값 그대로 둡니다.
 * - 가고 싶은 곳: 지금 휴대폰에 남는 저장(일 2 createWantedStore)을 그대로 감쌈 → 새로고침해도 남음
 * - 다녀온 곳·알림 닫기: 메모리에만(화면을 닫으면 사라짐). 일 4가 오면 휴대폰에 남음
 * 일 4가 합쳐지면: app.ts의 createTempSavedStore → createSavedStore, savedOrder·alertScenes는 '../domain/saved'에서.
 */
import type { Scene, StoryScene } from '../../shared/schema/content';
import { inWindow, type Month } from '../domain/month';
import { isYearRound } from '../domain/sceneTier';
import type { SceneTypeId } from '../domain/sceneTypes';
import type { SafeStore } from '../storage/safeStorage';
import { createWantedStore } from '../storage/wanted';

export interface WantedPlace { sceneId: string; savedOn: string }
export interface Visit { sceneId: string; date: string; name: string; type: SceneTypeId }

export interface SavedStore {
  readonly saved: boolean;
  isWanted(sceneId: string): boolean;
  toggleWanted(sceneId: string): boolean;
  wanted(): string[];
  wantedPlaces(): WantedPlace[];
  markVisited(scene: { id: string; name: string; types: readonly SceneTypeId[] }, date?: string): Visit;
  visitOf(sceneId: string, year?: number): Visit | null;
  changeVisitDate(sceneId: string, year: number, newDate: string): Visit | null;
  removeVisit(sceneId: string, year: number): void;
  visitsByYear(): { year: number; visits: Visit[] }[];
  alertClosed(month: string): boolean;
  closeAlert(month: string): void;
}

/** 한국 날짜 'YYYY-MM-DD' */
export function seoulDate(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)!.value;
  return `${v('year')}-${v('month')}-${v('day')}`;
}
const yearOf = (date: string) => Number(date.slice(0, 4));

export function createTempSavedStore(store: SafeStore, now: () => Date = () => new Date()): SavedStore {
  const wanted = createWantedStore(store);
  const savedOn = new Map<string, string>();
  let visits: Visit[] = [];
  const closed = new Set<string>();
  const today = () => seoulDate(now());
  return {
    get saved() {
      return wanted.saved;
    },
    isWanted: (id) => wanted.isWanted(id),
    toggleWanted(id) {
      const on = wanted.toggleWanted(id);
      if (on) savedOn.set(id, today());
      return on;
    },
    wanted: () => wanted.wanted(),
    wantedPlaces: () => wanted.wanted().map((id) => ({ sceneId: id, savedOn: savedOn.get(id) ?? today() })),
    markVisited(scene, date = today()) {
      const have = visits.find((v) => v.sceneId === scene.id && yearOf(v.date) === yearOf(date));
      if (have) return have;
      const v: Visit = { sceneId: scene.id, date, name: scene.name, type: scene.types[0]! };
      visits.push(v);
      if (wanted.isWanted(scene.id)) wanted.toggleWanted(scene.id);
      return v;
    },
    visitOf: (id, year = yearOf(today())) => visits.find((v) => v.sceneId === id && yearOf(v.date) === year) ?? null,
    changeVisitDate(id, year, newDate) {
      const v = visits.find((x) => x.sceneId === id && yearOf(x.date) === year);
      if (!v || newDate > today()) return null;
      if (yearOf(newDate) !== year && visits.some((x) => x.sceneId === id && yearOf(x.date) === yearOf(newDate))) return null;
      v.date = newDate;
      return v;
    },
    removeVisit(id, year) {
      visits = visits.filter((v) => !(v.sceneId === id && yearOf(v.date) === year));
      if (!wanted.isWanted(id)) wanted.toggleWanted(id);
    },
    visitsByYear() {
      const years = [...new Set(visits.map((v) => yearOf(v.date)))].sort((a, b) => b - a);
      return years.map((year) => ({ year, visits: visits.filter((v) => yearOf(v.date) === year).sort((a, b) => b.date.localeCompare(a.date)) }));
    },
    alertClosed: (m) => closed.has(m),
    closeAlert: (m) => void closed.add(m),
  };
}

export type SavedStatus =
  | { kind: 'now'; until: Month }
  | { kind: 'always' }
  | { kind: 'soon'; from: Month }
  | { kind: 'later'; from: Month }
  | { kind: 'none' }
  | { kind: 'missing' };
export interface SavedRow { sceneId: string; scene: StoryScene | null; status: SavedStatus }

const next = (m: Month, k = 1): Month => ((m - 1 + k) % 12) + 1;
const ahead = (from: Month, to: Month) => (to - from + 12) % 12;

/** 가고 싶은 곳을 '지금 가기 좋은 순'으로(F4) */
export function savedOrder(scenes: readonly Scene[], wantedIds: readonly string[], today: Month): SavedRow[] {
  const rank = { now: 0, always: 1, soon: 2, later: 3, none: 4, missing: 5 } as const;
  const rows: (SavedRow & { i: number })[] = wantedIds.map((id, i) => {
    const s = scenes.find((x) => x.id === id);
    if (!s || s.kind !== 'story' || s.hidden) return { sceneId: id, scene: null, status: { kind: 'missing' }, i };
    const b = s.best;
    let status: SavedStatus;
    if (!b) status = { kind: 'none' };
    else if (isYearRound(b)) status = { kind: 'always' };
    else if (inWindow(today, b)) status = { kind: 'now', until: b.to };
    else if (b.from === next(today)) status = { kind: 'soon', from: b.from };
    else status = { kind: 'later', from: b.from };
    return { sceneId: id, scene: s, status, i };
  });
  const name = (r: SavedRow) => r.scene?.name ?? '';
  return rows
    .sort((a, b) => {
      const d = rank[a.status.kind] - rank[b.status.kind];
      if (d) return d;
      if (a.status.kind === 'missing') return a.i - b.i;
      if (a.status.kind === 'now' && b.status.kind === 'now') return ahead(today, a.status.until) - ahead(today, b.status.until) || name(a).localeCompare(name(b), 'ko');
      if (a.status.kind === 'later' && b.status.kind === 'later') return ahead(next(today), a.status.from) - ahead(next(today), b.status.from) || name(a).localeCompare(name(b), 'ko');
      return name(a).localeCompare(name(b), 'ko');
    })
    .map(({ i: _i, ...r }) => r);
}

/** 제철 알림 카드(F4-AC10): 가고 싶은 곳 중 지금 좋은 곳 */
export function alertScenes(scenes: readonly Scene[], wantedIds: readonly string[], today: Month): StoryScene[] {
  return savedOrder(scenes, wantedIds, today)
    .filter((r) => r.status.kind === 'now')
    .map((r) => r.scene!);
}
