import { createSafeStore, type SafeStore } from './safeStorage';

export interface WantedStore {
  /** false여도 담기·빼기는 메모리에서 계속 작동한다. */
  readonly saved: boolean;
  isWanted(sceneId: string): boolean;
  /** 담기·빼기를 바꾸고, 바뀐 뒤 상태를 돌려준다(true = 담음). */
  toggleWanted(sceneId: string): boolean;
  /** 최근에 담은 장면 id가 앞에 온다. */
  wanted(): string[];
}

interface StoredWanted { v: 1; ids: string[] }
const KEY = 'wanted';

function isStoredWanted(value: unknown): value is StoredWanted {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.v === 1 && Array.isArray(record.ids)
    && record.ids.every((id): id is string => typeof id === 'string')
    && new Set(record.ids).size === record.ids.length;
}

/** 저장소를 생략하면 이 브라우저에 저장한다. */
export function createWantedStore(store: SafeStore = createSafeStore()): WantedStore {
  let ids: string[] = [];
  let saved = false;
  try {
    const stored = store.get<unknown>(KEY, undefined);
    if (stored === undefined) {
      saved = store.available;
    } else if (isStoredWanted(stored)) {
      ids = [...stored.ids];
      saved = store.available;
    }
  } catch {
    // 읽을 수 없으면 빈 목록으로 계속 쓴다.
  }

  function persist(): void {
    if (!saved) return;
    try {
      saved = store.set(KEY, { v: 1, ids: [...ids] } satisfies StoredWanted) && store.available;
    } catch {
      saved = false;
    }
  }
  // 읽기는 돼도 쓰기가 막힐 수 있으므로 처음에 실제 목록으로 확인한다.
  persist();

  return {
    get saved() { return saved; },
    isWanted(sceneId) { return ids.includes(sceneId); },
    toggleWanted(sceneId) {
      const wanted = !ids.includes(sceneId);
      ids = ids.filter((id) => id !== sceneId);
      if (wanted) ids.unshift(sceneId);
      persist();
      return wanted;
    },
    wanted() { return [...ids]; },
  };
}
