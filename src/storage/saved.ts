import { isSceneTypeId, type SceneTypeId } from '../domain/sceneTypes';
import { createSafeStore, type SafeStore } from './safeStorage';

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

// 취소 후 처음 저장한 날을 복원하기 위한 내부 값. 화면에 넘기는 Visit에는 넣지 않는다.
interface StoredVisit extends Visit { savedOn?: string }
interface StoredSaved { v: 1; wanted: WantedPlace[]; visits: StoredVisit[]; alertClosed: string[] }
const KEY = 'saved';
const dateFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
});
function dateInSeoul(now: Date): string {
  const parts = dateFormat.formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function yearOf(date: string): number { return Number(date.slice(0, 4)); }
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
function isWantedPlace(value: unknown): value is WantedPlace {
  return isRecord(value) && typeof value.sceneId === 'string' && isDate(value.savedOn);
}
function isVisit(value: unknown): value is StoredVisit {
  return isRecord(value) && typeof value.sceneId === 'string' && typeof value.name === 'string'
    && isDate(value.date) && typeof value.type === 'string' && isSceneTypeId(value.type)
    && (value.savedOn === undefined || isDate(value.savedOn));
}
function publicVisit(visit: Visit): Visit {
  return { sceneId: visit.sceneId, date: visit.date, name: visit.name, type: visit.type };
}
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length; }
function isStoredSaved(value: unknown): value is StoredSaved {
  if (!isRecord(value) || value.v !== 1) return false;
  if (!Array.isArray(value.wanted) || !value.wanted.every(isWantedPlace)) return false;
  if (!Array.isArray(value.visits) || !value.visits.every(isVisit)) return false;
  if (!Array.isArray(value.alertClosed) || !value.alertClosed.every(isMonth)) return false;
  return unique(value.wanted.map((place) => place.sceneId))
    && unique(value.visits.map((visit) => JSON.stringify([visit.sceneId, yearOf(visit.date)])));
}
function isLegacyWanted(value: unknown): value is { v: 1; ids: string[] } {
  return isRecord(value) && value.v === 1 && Array.isArray(value.ids)
    && value.ids.every((id): id is string => typeof id === 'string') && unique(value.ids);
}

/** 이 브라우저에 저장하며 날짜는 한국 날짜로 정한다. */
export function createSavedStore(store: SafeStore = createSafeStore(), now: () => Date = () => new Date()): SavedStore {
  let data: StoredSaved = { v: 1, wanted: [], visits: [], alertClosed: [] };
  let saved = false;
  let futureVersion = false;
  const today = () => dateInSeoul(now());
  const absent = {};
  try {
    const raw = store.get<unknown>(KEY, absent);
    if (isStoredSaved(raw)) {
      data = {
        v: 1, wanted: raw.wanted.map((place) => ({ ...place })),
        visits: raw.visits.map((visit) => ({ ...visit })), alertClosed: [...new Set(raw.alertClosed)],
      };
    } else if (isRecord(raw) && typeof raw.v === 'number' && raw.v >= 2) {
      futureVersion = true;
    } else if (raw === absent && store.available) {
      const legacy = store.get<unknown>('wanted', null);
      if (isLegacyWanted(legacy)) {
        const savedOn = today();
        data.wanted = legacy.ids.map((sceneId) => ({ sceneId, savedOn }));
      }
    }
  } catch {
    // 저장값을 읽지 못해도 빈 목록을 메모리에서 쓸 수 있다.
  }
  const snapshot = (): StoredSaved => ({
    v: 1, wanted: data.wanted.map((place) => ({ ...place })),
    visits: data.visits.map((visit) => ({ ...visit })), alertClosed: [...data.alertClosed],
  });
  function persist(): void {
    if (futureVersion) return;
    try {
      const value = snapshot();
      saved = store.set(KEY, value);
      if (saved) {
        // 깨진 JSON을 읽은 뒤 available은 false로 남을 수 있다. 다시 읽어 복구를 확인한다.
        const readBack = store.get<unknown>(KEY, null);
        saved = isStoredSaved(readBack) && JSON.stringify(readBack) === JSON.stringify(value);
      }
    } catch {
      saved = false;
    }
  }
  // 읽기·쓰기를 실제로 해 보며 깨진 값은 빈 저장값으로 복구한다.
  persist();
  function sortWanted(): void {
    data.wanted.sort((a, b) => b.savedOn.localeCompare(a.savedOn));
  }

  return {
    get saved() { return saved; },
    isWanted(sceneId) { return data.wanted.some((place) => place.sceneId === sceneId); },
    toggleWanted(sceneId) {
      const wanted = !data.wanted.some((place) => place.sceneId === sceneId);
      data.wanted = data.wanted.filter((place) => place.sceneId !== sceneId);
      if (wanted) {
        const savedOn = today();
        data.wanted.unshift({ sceneId, savedOn }); sortWanted();
      }
      persist(); return wanted;
    },
    wanted() { return data.wanted.map((place) => place.sceneId); },
    wantedPlaces() { return data.wanted.map((place) => ({ ...place })); },
    markVisited(scene, date) {
      const visitDate = date ?? today();
      const existing = data.visits.find((visit) => visit.sceneId === scene.id && yearOf(visit.date) === yearOf(visitDate));
      const wanted = data.wanted.find((place) => place.sceneId === scene.id);
      const visit: StoredVisit = existing ?? {
        sceneId: scene.id, date: visitDate, name: scene.name, type: scene.types[0]!,
        ...(wanted ? { savedOn: wanted.savedOn } : {}),
      };
      if (!existing) data.visits.unshift(visit);
      data.wanted = data.wanted.filter((place) => place.sceneId !== scene.id);
      persist(); return publicVisit(visit);
    },
    visitOf(sceneId, year = yearOf(today())) {
      const visit = data.visits.find((visit) => visit.sceneId === sceneId && yearOf(visit.date) === year);
      return visit ? publicVisit(visit) : null;
    },
    changeVisitDate(sceneId, year, newDate) {
      if (!isDate(newDate) || newDate > today()) return null;
      const visit = data.visits.find((item) => item.sceneId === sceneId && yearOf(item.date) === year);
      if (!visit || data.visits.some((item) => item !== visit && item.sceneId === sceneId && yearOf(item.date) === yearOf(newDate))) return null;
      visit.date = newDate; persist(); return publicVisit(visit);
    },
    removeVisit(sceneId, year) {
      const visit = data.visits.find((visit) => visit.sceneId === sceneId && yearOf(visit.date) === year);
      if (!visit) return;
      data.visits = data.visits.filter((visit) => visit.sceneId !== sceneId || yearOf(visit.date) !== year);
      if (!data.wanted.some((place) => place.sceneId === sceneId)) {
        const savedOn = visit.savedOn ?? today();
        data.wanted.unshift({ sceneId, savedOn }); sortWanted();
      }
      persist();
    },
    visitsByYear() {
      const groups = new Map<number, Visit[]>();
      for (const visit of data.visits) {
        const year = yearOf(visit.date); const visits = groups.get(year) ?? [];
        visits.push(publicVisit(visit)); groups.set(year, visits);
      }
      return [...groups].sort(([a], [b]) => b - a).map(([year, visits]) => ({
        year, visits: visits.sort((a, b) => b.date.localeCompare(a.date)),
      }));
    },
    alertClosed(month) { return data.alertClosed.includes(month); },
    closeAlert(month) {
      if (!isMonth(month) || data.alertClosed.includes(month)) return;
      data.alertClosed.push(month);
      data.alertClosed.sort((a, b) => b.localeCompare(a));
      data.alertClosed = data.alertClosed.slice(0, 12); persist();
    },
  };
}
