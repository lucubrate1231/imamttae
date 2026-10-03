/**
 * 휴대폰(브라우저)에만 저장하는 작은 저장소.
 * 사생활 보호 모드, 저장 공간 부족, 깨진 값이 있어도 앱이 멈추지 않게 모든 읽기·쓰기를 감쌉니다.
 */
const PREFIX = 'imamttae:';

export interface SafeStore {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): boolean;
  readonly available: boolean;
}

export function createSafeStore(getStorage: () => Storage = () => window.localStorage): SafeStore {
  let storage: Storage | null = null;
  try {
    storage = getStorage();
  } catch {
    storage = null;
  }
  let available = storage !== null;
  return {
    get<T>(key: string, fallback: T): T {
      if (!storage) return fallback;
      try {
        const raw = storage.getItem(PREFIX + key);
        if (raw === null) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        available = false;
        return fallback;
      }
    },
    set(key: string, value: unknown): boolean {
      if (!storage) return false;
      try {
        storage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch {
        available = false;
        return false;
      }
    },
    get available() {
      return available;
    },
  };
}
