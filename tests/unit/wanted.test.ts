import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSafeStore } from '../../src/storage/safeStorage';
import { createWantedStore } from '../../src/storage/wanted';
afterEach(() => vi.unstubAllGlobals());

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}

function setup() {
  const storage = memoryStorage();
  const store = createSafeStore(() => storage);
  return { storage, store, wanted: createWantedStore(store) };
}

describe('가고 싶어요 담기·빼기 (F2-AC2c)', () => {
  it('빈 목록으로 시작하고 저장 가능 여부를 바로 알려 준다', () => {
    const { wanted } = setup();
    expect(wanted.saved).toBe(true);
    expect(wanted.wanted()).toEqual([]);
    expect(wanted.isWanted('설악')).toBe(false);
  });
  it('담으면 true, 다시 누르면 false를 돌려주고 같은 장면이 두 번 나오지 않는다', () => {
    const { wanted } = setup();
    for (let index = 0; index < 5; index++) {
      expect(wanted.toggleWanted('설악')).toBe(true);
      expect(wanted.isWanted('설악')).toBe(true);
      expect(wanted.wanted()).toEqual(['설악']);
      expect(wanted.toggleWanted('설악')).toBe(false);
      expect(wanted.isWanted('설악')).toBe(false);
      expect(wanted.wanted()).toEqual([]);
    }
  });
  it('최근 담은 것이 앞이고 중간 것을 뺐다 다시 담으면 맨 앞이다', () => {
    const { wanted } = setup();
    wanted.toggleWanted('a');
    wanted.toggleWanted('b');
    wanted.toggleWanted('c');
    expect(wanted.wanted()).toEqual(['c', 'b', 'a']);
    wanted.toggleWanted('b');
    expect(wanted.wanted()).toEqual(['c', 'a']);
    wanted.toggleWanted('b');
    expect(wanted.wanted()).toEqual(['b', 'c', 'a']);
  });
  it('장면 id가 객체의 속성 이름과 같아도 담고 뺄 수 있다', () => {
    const { wanted } = setup();
    expect(wanted.toggleWanted('__proto__')).toBe(true);
    expect(wanted.toggleWanted('constructor')).toBe(true);
    expect(wanted.wanted()).toEqual(['constructor', '__proto__']);
    expect(wanted.toggleWanted('__proto__')).toBe(false);
    expect(wanted.isWanted('__proto__')).toBe(false);
  });
  it('데이터에서 빠진 장면 id도 그대로 읽고 직접 뺄 수 있다', () => {
    const storage = memoryStorage();
    storage.setItem('imamttae:wanted', JSON.stringify({ v: 1, ids: ['removed-scene', '설악'] }));
    const wanted = createWantedStore(createSafeStore(() => storage));
    expect(wanted.saved).toBe(true);
    expect(wanted.wanted()).toEqual(['removed-scene', '설악']);
    expect(wanted.isWanted('removed-scene')).toBe(true);
    expect(wanted.toggleWanted('removed-scene')).toBe(false);
    expect(wanted.wanted()).toEqual(['설악']);
  });
  it('돌려받은 목록을 고쳐도 저장된 목록은 바뀌지 않는다', () => {
    const { wanted, store } = setup();
    wanted.toggleWanted('a');
    const list = wanted.wanted();
    list[0] = '바꾼 값';
    list.push('b');
    expect(wanted.wanted()).toEqual(['a']);
    expect(createWantedStore(store).wanted()).toEqual(['a']);
  });
});

describe('새로고침 후 유지 (F2-AC2c)', () => {
  it('새로 만들어도 담은 순서와 상태가 남고 새로 담은 것이 맨 앞이다', () => {
    const { wanted, storage } = setup();
    wanted.toggleWanted('a');
    wanted.toggleWanted('b');
    const reloaded = createWantedStore(createSafeStore(() => storage));
    expect(reloaded.saved).toBe(true);
    expect(reloaded.isWanted('a')).toBe(true);
    expect(reloaded.wanted()).toEqual(['b', 'a']);
    reloaded.toggleWanted('c');
    expect(createWantedStore(createSafeStore(() => storage)).wanted()).toEqual(['c', 'b', 'a']);
  });
  it('빼기도 새로고침 뒤 유지되고 모두 빼면 빈 목록으로 남는다', () => {
    const { wanted, storage } = setup();
    wanted.toggleWanted('a');
    wanted.toggleWanted('b');
    wanted.toggleWanted('a');
    const reloaded = createWantedStore(createSafeStore(() => storage));
    expect(reloaded.wanted()).toEqual(['b']);
    reloaded.toggleWanted('b');
    expect(createWantedStore(createSafeStore(() => storage)).wanted()).toEqual([]);
  });
  it('wanted 열쇠 하나에 판 번호와 장면 id 목록만 저장한다', () => {
    const { wanted, storage } = setup();
    wanted.toggleWanted('a');
    wanted.toggleWanted('b');
    expect(storage.length).toBe(1);
    expect(storage.key(0)).toBe('imamttae:wanted');
    expect(JSON.parse(storage.getItem('imamttae:wanted')!)).toEqual({ v: 1, ids: ['b', 'a'] });
  });
  it('저장소를 생략하면 이 브라우저 저장소를 쓴다', () => {
    const storage = memoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    expect(createWantedStore().toggleWanted('a')).toBe(true);
    const reloaded = createWantedStore();
    expect(reloaded.saved).toBe(true);
    expect(reloaded.wanted()).toEqual(['a']);
  });
});

describe('저장이 막혀도 계속 동작 (C-4, F2-AC2c)', () => {
  it('저장소 접근이 막히면 saved는 false이고 메모리에서 담고 뺀다', () => {
    const store = createSafeStore(() => { throw new Error('SecurityError'); });
    const wanted = createWantedStore(store);
    expect(wanted.saved).toBe(false);
    expect(wanted.toggleWanted('a')).toBe(true);
    expect(wanted.isWanted('a')).toBe(true);
    expect(wanted.wanted()).toEqual(['a']);
    expect(createWantedStore(store).wanted()).toEqual([]);
    expect(wanted.toggleWanted('a')).toBe(false);
    expect(wanted.wanted()).toEqual([]);
  });
  it('쓰기만 막힌 저장소도 처음부터 saved가 false다', () => {
    const storage = memoryStorage();
    storage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    const store = createSafeStore(() => storage);
    expect(store.available).toBe(true);
    const wanted = createWantedStore(store);
    expect(wanted.saved).toBe(false);
    expect(wanted.toggleWanted('a')).toBe(true);
    expect(wanted.wanted()).toEqual(['a']);
  });
  it('쓰기만 막혀도 이미 저장된 목록을 메모리에서 계속 쓴다', () => {
    const storage = memoryStorage();
    storage.setItem('imamttae:wanted', JSON.stringify({ v: 1, ids: ['a'] }));
    storage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    const wanted = createWantedStore(createSafeStore(() => storage));
    expect(wanted.saved).toBe(false);
    expect(wanted.wanted()).toEqual(['a']);
    expect(wanted.toggleWanted('b')).toBe(true);
    expect(wanted.wanted()).toEqual(['b', 'a']);
  });
  it('읽기가 막혀도 빈 목록으로 시작하고 담고 뺄 수 있다', () => {
    const storage = memoryStorage();
    storage.getItem = () => { throw new Error('blocked'); };
    const wanted = createWantedStore(createSafeStore(() => storage));
    expect(wanted.saved).toBe(false);
    expect(wanted.wanted()).toEqual([]);
    expect(wanted.toggleWanted('a')).toBe(true);
    expect(wanted.toggleWanted('a')).toBe(false);
  });
  it('사용 중 공간이 부족해져도 기존 목록과 새 변경이 메모리에 남는다', () => {
    const { wanted, storage } = setup();
    wanted.toggleWanted('a');
    storage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    expect(wanted.toggleWanted('b')).toBe(true);
    expect(wanted.saved).toBe(false);
    expect(wanted.wanted()).toEqual(['b', 'a']);
    expect(wanted.toggleWanted('a')).toBe(false);
    expect(wanted.wanted()).toEqual(['b']);
  });
  it('기본 브라우저 저장소 접근이 막혀도 예외 없이 동작한다', () => {
    vi.stubGlobal('window', { get localStorage(): Storage { throw new Error('SecurityError'); } });
    const wanted = createWantedStore();
    expect(wanted.saved).toBe(false);
    expect(wanted.toggleWanted('a')).toBe(true);
  });
});

describe('깨진 값과 모르는 저장 모양 (C-4, F2-AC2c)', () => {
  it('깨진 JSON은 빈 목록과 saved false로 시작하고 메모리에서 담고 뺀다', () => {
    const storage = memoryStorage();
    storage.setItem('imamttae:wanted', '{broken');
    const wanted = createWantedStore(createSafeStore(() => storage));
    expect(wanted.saved).toBe(false);
    expect(wanted.wanted()).toEqual([]);
    expect(wanted.toggleWanted('a')).toBe(true);
    expect(wanted.toggleWanted('a')).toBe(false);
  });
  it.each([
    ['null', null],
    ['배열', ['a']],
    ['모르는 판 번호', { v: 99, ids: ['a'] }],
    ['없는 판 번호', { ids: ['a'] }],
    ['없는 목록', { v: 1 }],
    ['목록 대신 문자열', { v: 1, ids: 'a' }],
    ['문자열이 아닌 id', { v: 1, ids: ['a', 3] }],
    ['중복된 id', { v: 1, ids: ['a', 'a'] }],
  ])('%s 값도 빈 목록으로 시작하고 메모리에서 계속 쓴다', (_name, value) => {
    const storage = memoryStorage();
    storage.setItem('imamttae:wanted', JSON.stringify(value));
    const wanted = createWantedStore(createSafeStore(() => storage));
    expect(wanted.saved).toBe(false);
    expect(wanted.wanted()).toEqual([]);
    expect(wanted.isWanted('a')).toBe(false);
    expect(wanted.toggleWanted('b')).toBe(true);
    expect(wanted.wanted()).toEqual(['b']);
    expect(wanted.toggleWanted('b')).toBe(false);
  });
});
