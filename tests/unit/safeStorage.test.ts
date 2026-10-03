import { describe, expect, it } from 'vitest';
import { createSafeStore } from '../../src/storage/safeStorage';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}
const throwing: Storage = {
  length: 0,
  clear() { throw new Error('blocked'); },
  getItem() { throw new Error('blocked'); },
  key() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
  setItem() { throw new DOMException('QuotaExceededError'); },
};

describe('createSafeStore: 저장이 막혀도 앱이 멈추지 않는다', () => {
  it('저장하고 다시 읽는다', () => {
    const s = createSafeStore(() => memoryStorage());
    expect(s.set('navi', 'kakao')).toBe(true);
    expect(s.get('navi', 'none')).toBe('kakao');
  });
  it('없는 값은 기본값', () => {
    const s = createSafeStore(() => memoryStorage());
    expect(s.get('stamps', {})).toEqual({});
  });
  it('저장소가 예외를 던지면 기본값을 주고 false를 돌려준다', () => {
    const s = createSafeStore(() => throwing);
    expect(s.get('navi', 'none')).toBe('none');
    expect(s.set('navi', 'kakao')).toBe(false);
    expect(s.available).toBe(false);
  });
  it('저장소에 접근하는 것 자체가 막혀도(사생활 보호 모드) 멈추지 않는다', () => {
    const s = createSafeStore(() => { throw new Error('SecurityError'); });
    expect(s.get('x', 1)).toBe(1);
    expect(s.set('x', 2)).toBe(false);
  });
  it('깨진 값이 들어 있으면 기본값', () => {
    const mem = memoryStorage();
    mem.setItem('imamttae:stamps', '{broken');
    const s = createSafeStore(() => mem);
    expect(s.get('stamps', { ok: true })).toEqual({ ok: true });
  });
  it('키 앞에 앱 이름을 붙여 다른 사이트 값과 섞이지 않게 한다', () => {
    const mem = memoryStorage();
    createSafeStore(() => mem).set('navi', 'naver');
    expect(mem.getItem('imamttae:navi')).toBe('"naver"');
  });
});
