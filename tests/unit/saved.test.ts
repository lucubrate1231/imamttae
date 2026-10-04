import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSafeStore } from '../../src/storage/safeStorage';

let createSavedStore: typeof import('../../src/storage/saved').createSavedStore;
beforeEach(async () => { ({ createSavedStore } = await import('../../src/storage/saved')); });
afterEach(() => vi.unstubAllGlobals());

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, String(value)),
  };
}
const place = { id: 'waterfall', name: '계곡의 폭포', types: ['gyegok', 'danpung'] as const };
const today = () => new Date('2026-10-03T15:05:00Z');
const empty = () => ({ v: 1, wanted: [], visits: [], alertClosed: [] });
function setup() {
  const storage = memoryStorage();
  const store = createSafeStore(() => storage);
  return { storage, store, saved: createSavedStore(store, today) };
}

describe('저장한 날과 담기·빼기 (F4-AC3·14)', () => {
  it('빈 저장소에서 모든 목록과 도장과 알림 상태가 비어 있다', () => {
    const { saved } = setup();
    expect(saved.saved).toBe(true);
    expect(saved.wanted()).toEqual([]);
    expect(saved.wantedPlaces()).toEqual([]);
    expect(saved.visitsByYear()).toEqual([]);
    expect(saved.visitOf(place.id)).toBeNull();
    expect(saved.alertClosed('2026-10')).toBe(false);
  });
  it('일 2와 같은 담기·빼기 함수이며 한국 날짜와 최근 저장 순서를 남긴다', () => {
    const { saved } = setup();
    expect(saved.toggleWanted('a')).toBe(true);
    expect(saved.isWanted('a')).toBe(true);
    saved.toggleWanted('b');
    expect(saved.wanted()).toEqual(['b', 'a']);
    expect(saved.wantedPlaces()).toEqual([
      { sceneId: 'b', savedOn: '2026-10-04' }, { sceneId: 'a', savedOn: '2026-10-04' },
    ]);
    expect(saved.toggleWanted('a')).toBe(false);
    expect(saved.isWanted('a')).toBe(false);
    expect(saved.wanted()).toEqual(['b']);
  });
  it('빼고 다시 저장하면 새 저장한 날로 갱신한다', () => {
    let date = new Date('2026-10-01T00:00:00Z');
    const saved = createSavedStore(createSafeStore(() => memoryStorage()), () => date);
    saved.toggleWanted('a'); saved.toggleWanted('a');
    date = today(); saved.toggleWanted('a');
    expect(saved.wantedPlaces()).toEqual([{ sceneId: 'a', savedOn: '2026-10-04' }]);
  });
  it('알 수 없는 장면 번호와 객체 속성 이름도 그대로 저장한다', () => {
    const { saved } = setup();
    saved.toggleWanted('removed-scene'); saved.toggleWanted('__proto__');
    expect(saved.wanted()).toEqual(['__proto__', 'removed-scene']);
  });
  it('한국 자정에 저장한 날짜가 바뀐다', () => {
    let date = new Date('2026-10-03T14:59:00Z');
    const saved = createSavedStore(createSafeStore(() => memoryStorage()), () => date);
    saved.toggleWanted('a');
    date = new Date('2026-10-03T15:01:00Z'); saved.toggleWanted('b');
    expect(saved.wantedPlaces()).toEqual([
      { sceneId: 'b', savedOn: '2026-10-04' }, { sceneId: 'a', savedOn: '2026-10-03' },
    ]);
  });
});

describe('장소 도장과 새해 (F4-AC5·7·8·12·13)', () => {
  it('다녀왔어요는 장소 도장 하나를 찍고 첫 풍경과 이름을 보관하며 저장 목록에서 뺀다', () => {
    const { saved } = setup(); saved.toggleWanted(place.id); saved.toggleWanted('other');
    expect(saved.markVisited(place)).toEqual({ sceneId: place.id, date: '2026-10-04', name: place.name, type: 'gyegok' });
    expect(saved.wanted()).toEqual(['other']);
    expect(saved.visitOf(place.id)).toEqual({ sceneId: place.id, date: '2026-10-04', name: place.name, type: 'gyegok' });
  });
  it('그해 이미 찍은 장소 도장은 이름·날짜·대표 풍경을 덮어쓰지 않는다', () => {
    const { saved } = setup();
    const first = saved.markVisited(place, '2026-09-30');
    saved.toggleWanted(place.id);
    expect(saved.markVisited({ ...place, name: '바뀐 이름', types: ['bada'] }, '2026-10-01')).toEqual(first);
    expect(saved.wanted()).toEqual([]);
    expect(saved.visitsByYear()[0]?.visits).toHaveLength(1);
  });
  it('같은 풍경이어도 다른 장소의 도장은 각각 남는다', () => {
    const { saved } = setup(); saved.markVisited(place);
    saved.markVisited({ ...place, id: 'another-place' });
    expect(saved.visitsByYear()[0]?.visits).toHaveLength(2);
  });
  it('지난날을 지정하면 다녀온 날의 해에 보관하고 최근 해·최근 날짜 순으로 묶는다', () => {
    const { saved } = setup();
    saved.markVisited(place, '2024-12-31');
    saved.markVisited({ ...place, id: 'old' }, '2025-03-01');
    saved.markVisited({ ...place, id: 'new' }, '2025-09-01');
    expect(saved.visitsByYear().map((group) => [group.year, group.visits.map((visit) => visit.sceneId)])).toEqual([
      [2025, ['new', 'old']], [2024, [place.id]],
    ]);
    expect(saved.visitOf(place.id)).toBeNull();
    expect(saved.visitOf(place.id, 2024)?.date).toBe('2024-12-31');
  });
  it('새해에는 같은 곳에 새 도장을 찍고 지난해 도장과 가고 싶은 곳은 유지한다', () => {
    let date = new Date('2026-12-31T14:59:00Z');
    const saved = createSavedStore(createSafeStore(() => memoryStorage()), () => date);
    saved.markVisited(place); saved.toggleWanted('remain'); saved.toggleWanted(place.id);
    date = new Date('2026-12-31T15:01:00Z');
    expect(saved.visitOf(place.id)).toBeNull();
    expect(saved.visitsByYear().map((group) => group.year)).toEqual([2026]);
    expect(saved.wanted()).toEqual([place.id, 'remain']);
    expect(saved.markVisited(place).date).toBe('2027-01-01');
    expect(saved.visitsByYear().map((group) => group.year)).toEqual([2027, 2026]);
    expect(saved.wanted()).toEqual(['remain']);
  });
  it('장면 정보가 나중에 바뀌어도 저장한 당시 이름과 대표 풍경이 남는다', () => {
    const { saved, storage } = setup();
    const scene = { ...place, types: ['gyegok', 'danpung'] as ('gyegok' | 'danpung')[] };
    saved.markVisited(scene); scene.name = '수정된 이름'; scene.types[0] = 'danpung';
    const reloaded = createSavedStore(createSafeStore(() => storage), today);
    expect(reloaded.visitOf(place.id)?.name).toBe(place.name);
    expect(reloaded.visitOf(place.id)?.type).toBe('gyegok');
  });
});

describe('방문 날짜 변경과 취소 (F4-AC6)', () => {
  it('날짜를 바꾸면 같은 도장이 다른 해의 묶음으로 옮겨진다', () => {
    const { saved } = setup(); saved.markVisited(place);
    expect(saved.changeVisitDate(place.id, 2026, '2025-12-31')).toEqual({
      sceneId: place.id, date: '2025-12-31', name: place.name, type: 'gyegok',
    });
    expect(saved.visitOf(place.id, 2026)).toBeNull();
    expect(saved.visitsByYear().map((group) => group.year)).toEqual([2025]);
  });
  it('바꾸려는 해에 같은 장소 도장이 있으면 거절하고 기존 두 도장은 유지한다', () => {
    const { saved } = setup(); saved.markVisited(place, '2025-12-31'); saved.markVisited(place);
    expect(saved.changeVisitDate(place.id, 2026, '2025-11-01')).toBeNull();
    expect(saved.visitsByYear().map((group) => group.year)).toEqual([2026, 2025]);
    expect(saved.visitOf(place.id)?.date).toBe('2026-10-04');
  });
  it('같은 해에서 날짜를 바꾸거나 같은 날짜를 고르는 것은 허용한다', () => {
    const { saved } = setup(); saved.markVisited(place);
    expect(saved.changeVisitDate(place.id, 2026, '2026-10-03')?.date).toBe('2026-10-03');
    expect(saved.changeVisitDate(place.id, 2026, '2026-10-03')?.date).toBe('2026-10-03');
    expect(saved.visitsByYear()[0]?.visits).toHaveLength(1);
  });
  it.each(['2026-10-05', '2027-01-01', '2026-02-30', '2026-1-1', '어제', ''])('%s: 미래 또는 잘못된 날짜는 거절한다', (date) => {
    const { saved } = setup(); saved.markVisited(place);
    expect(saved.changeVisitDate(place.id, 2026, date)).toBeNull();
    expect(saved.visitOf(place.id)?.date).toBe('2026-10-04');
  });
  it('윤년의 실제 날짜는 허용하고 없는 도장의 변경과 취소는 아무것도 바꾸지 않는다', () => {
    const { saved } = setup(); saved.markVisited(place);
    expect(saved.changeVisitDate(place.id, 2026, '2024-02-29')?.date).toBe('2024-02-29');
    expect(saved.changeVisitDate('missing', 2026, '2026-10-01')).toBeNull();
    saved.removeVisit('missing', 2026);
    expect(saved.wanted()).toEqual([]);
    expect(saved.visitOf(place.id, 2024)?.date).toBe('2024-02-29');
  });
  it('도장을 지우면 처음 저장한 날로 가고 싶은 곳에 돌아오고 최근 저장 순서를 지킨다', () => {
    let date = new Date('2026-09-01T00:00:00Z');
    const saved = createSavedStore(createSafeStore(() => memoryStorage()), () => date);
    saved.toggleWanted(place.id);
    date = today(); saved.markVisited(place); saved.toggleWanted('later-saved');
    saved.removeVisit(place.id, 2026);
    expect(saved.visitOf(place.id)).toBeNull();
    expect(saved.wantedPlaces()).toEqual([
      { sceneId: 'later-saved', savedOn: '2026-10-04' }, { sceneId: place.id, savedOn: '2026-09-01' },
    ]);
  });
  it('처음 저장한 날을 모르면 오늘로 돌아오고 이미 담긴 곳은 중복하지 않는다', () => {
    const { saved } = setup(); saved.markVisited(place); saved.removeVisit(place.id, 2026);
    expect(saved.wantedPlaces()).toEqual([{ sceneId: place.id, savedOn: '2026-10-04' }]);
    saved.markVisited(place); saved.toggleWanted(place.id); saved.removeVisit(place.id, 2026);
    expect(saved.wanted()).toEqual([place.id]);
  });
  it('한 해 도장을 지워도 다른 해의 같은 장소 도장은 남는다', () => {
    const { saved } = setup(); saved.markVisited(place, '2025-12-31'); saved.markVisited(place);
    saved.removeVisit(place.id, 2026);
    expect(saved.visitOf(place.id)).toBeNull();
    expect(saved.visitOf(place.id, 2025)?.date).toBe('2025-12-31');
  });
});

describe('알림 닫기·새로고침·옛 목록 옮기기 (F4-AC10·14)', () => {
  it('알림을 닫으면 그달에만 닫힌 상태이고 다음 달은 다시 열린다', () => {
    const { saved, storage } = setup(); saved.closeAlert('2026-10'); saved.closeAlert('2026-10');
    expect(saved.alertClosed('2026-10')).toBe(true);
    expect(saved.alertClosed('2026-11')).toBe(false);
    const reloaded = createSavedStore(createSafeStore(() => storage), today);
    expect(reloaded.alertClosed('2026-10')).toBe(true);
  });
  it('가고 싶은 곳과 도장과 알림을 saved 열쇠 하나에 판 번호와 함께 저장한다', () => {
    const { saved, storage } = setup(); saved.toggleWanted('a'); saved.markVisited(place); saved.closeAlert('2026-10');
    expect(storage.length).toBe(1);
    expect(JSON.parse(storage.getItem('imamttae:saved')!)).toEqual({
      v: 1, wanted: [{ sceneId: 'a', savedOn: '2026-10-04' }],
      visits: [{ sceneId: place.id, name: place.name, type: 'gyegok', date: '2026-10-04' }], alertClosed: ['2026-10'],
    });
    const reloaded = createSavedStore(createSafeStore(() => storage), today);
    expect(reloaded.wantedPlaces()).toEqual(saved.wantedPlaces());
    expect(reloaded.visitsByYear()).toEqual(saved.visitsByYear());
  });
  it('빼기·날짜 변경·취소도 새로고침 뒤에 남는다', () => {
    const { saved, storage } = setup(); saved.toggleWanted('a'); saved.toggleWanted('a');
    saved.markVisited(place); saved.changeVisitDate(place.id, 2026, '2025-12-31');
    const reloaded = createSavedStore(createSafeStore(() => storage), today);
    expect(reloaded.wanted()).toEqual([]);
    expect(reloaded.visitOf(place.id, 2025)?.date).toBe('2025-12-31');
    reloaded.removeVisit(place.id, 2025);
    expect(createSavedStore(createSafeStore(() => storage), today).wanted()).toEqual([place.id]);
    expect(createSavedStore(createSafeStore(() => storage), today).visitsByYear()).toEqual([]);
  });
  it('saved가 없을 때 일 2 목록을 순서대로 오늘 날짜로 옮기고 옛 값은 그대로 둔다', () => {
    const storage = memoryStorage(); const legacy = JSON.stringify({ v: 1, ids: ['b', 'a', 'removed-scene'] });
    storage.setItem('imamttae:wanted', legacy);
    const saved = createSavedStore(createSafeStore(() => storage), today);
    expect(saved.saved).toBe(true);
    expect(saved.wantedPlaces()).toEqual(['b', 'a', 'removed-scene'].map((sceneId) => ({ sceneId, savedOn: '2026-10-04' })));
    expect(storage.getItem('imamttae:wanted')).toBe(legacy);
    saved.toggleWanted('a');
    expect(createSavedStore(createSafeStore(() => storage), today).wanted()).toEqual(['b', 'removed-scene']);
  });
  it('saved가 이미 있으면 비어 있어도 일 2 값을 다시 가져오지 않는다', () => {
    const storage = memoryStorage(); storage.setItem('imamttae:saved', JSON.stringify(empty()));
    storage.setItem('imamttae:wanted', JSON.stringify({ v: 1, ids: ['a'] }));
    expect(createSavedStore(createSafeStore(() => storage), today).wanted()).toEqual([]);
  });
  it('새해에 새로 열어도 지난해 도장과 저장한 목록이 남으며 빈 올해 묶음은 만들지 않는다', () => {
    const storage = memoryStorage();
    const saved = createSavedStore(createSafeStore(() => storage), () => new Date('2026-12-31T14:59:00Z'));
    saved.markVisited(place); saved.toggleWanted('a');
    const reloaded = createSavedStore(createSafeStore(() => storage), () => new Date('2026-12-31T15:01:00Z'));
    expect(reloaded.visitOf(place.id)).toBeNull();
    expect(reloaded.visitsByYear().map((group) => group.year)).toEqual([2026]);
    expect(reloaded.wanted()).toEqual(['a']);
  });
  it('저장소와 시각을 생략하면 브라우저에 저장하고 한국 날짜를 쓴다', () => {
    vi.stubGlobal('window', { localStorage: memoryStorage() });
    const saved = createSavedStore(); saved.toggleWanted('a');
    expect(saved.wantedPlaces()[0]?.savedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(createSavedStore().wanted()).toEqual(['a']);
  });
});

describe('저장 실패와 깨진 값 복구 (F4-AC16)', () => {
  it('접근이 막혀도 모든 저장 함수가 메모리에서 작동한다', () => {
    const saved = createSavedStore(createSafeStore(() => { throw new Error('SecurityError'); }), today);
    expect(saved.saved).toBe(false); saved.toggleWanted(place.id);
    saved.markVisited(place); saved.changeVisitDate(place.id, 2026, '2025-12-31');
    saved.closeAlert('2026-10'); saved.removeVisit(place.id, 2025);
    expect(saved.wanted()).toEqual([place.id]);
    expect(saved.visitsByYear()).toEqual([]); expect(saved.alertClosed('2026-10')).toBe(true);
  });
  it('쓰기만 막혀도 처음부터 saved가 false이고 읽어 둔 목록은 유지한다', () => {
    const storage = memoryStorage(); storage.setItem('imamttae:saved', JSON.stringify({ ...empty(), wanted: [{ sceneId: 'a', savedOn: '2026-09-01' }] }));
    storage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    const saved = createSavedStore(createSafeStore(() => storage), today);
    expect(saved.saved).toBe(false); expect(saved.wanted()).toEqual(['a']);
    saved.toggleWanted('b'); expect(saved.wanted()).toEqual(['b', 'a']);
  });
  it('사용 중 공간이 부족해져도 도장과 알림과 새 목록을 메모리에서 유지한다', () => {
    const { saved, storage } = setup(); saved.toggleWanted(place.id);
    storage.setItem = () => { throw new DOMException('QuotaExceededError'); };
    saved.markVisited(place); saved.closeAlert('2026-10'); saved.toggleWanted('a');
    expect(saved.saved).toBe(false); expect(saved.visitOf(place.id)).not.toBeNull();
    expect(saved.wanted()).toEqual(['a']); expect(saved.alertClosed('2026-10')).toBe(true);
  });
  it('읽기가 계속 막히면 쓰기가 가능해도 saved는 false다', () => {
    const storage = memoryStorage(); storage.getItem = () => { throw new Error('blocked'); };
    const saved = createSavedStore(createSafeStore(() => storage), today);
    expect(saved.saved).toBe(false); expect(saved.toggleWanted('a')).toBe(true);
  });
  it('깨진 JSON은 빈 저장값으로 복구하고 이후 새 저장을 이어 간다', () => {
    const storage = memoryStorage(); storage.setItem('imamttae:saved', '{broken');
    const saved = createSavedStore(createSafeStore(() => storage), today);
    expect(saved.saved).toBe(true); expect(saved.wanted()).toEqual([]); saved.toggleWanted('a');
    expect(createSavedStore(createSafeStore(() => storage), today).wanted()).toEqual(['a']);
  });
  it.each([
    ['판 번호 없음', { wanted: [] }], ['null', null], ['없는 목록', { v: 1 }],
    ['잘못된 저장 날짜', { ...empty(), wanted: [{ sceneId: 'a', savedOn: '2026-02-30' }] }],
    ['중복 저장', { ...empty(), wanted: [{ sceneId: 'a', savedOn: '2026-10-04' }, { sceneId: 'a', savedOn: '2026-10-04' }] }],
    ['모르는 대표 풍경', { ...empty(), visits: [{ sceneId: 'a', name: '이름', date: '2026-10-04', type: 'unknown' }] }],
    ['없는 방문 날짜', { ...empty(), visits: [{ sceneId: 'a', name: '이름', date: '2026-02-30', type: 'bada' }] }],
    ['잘못된 알림 달', { ...empty(), alertClosed: ['2026-13'] }],
  ])('%s 값은 빈 저장값으로 복구한다', (_name, value) => {
    const storage = memoryStorage(); storage.setItem('imamttae:saved', JSON.stringify(value));
    const saved = createSavedStore(createSafeStore(() => storage), today);
    expect(saved.saved).toBe(true); expect(saved.visitsByYear()).toEqual([]); expect(saved.wanted()).toEqual([]);
    expect(JSON.parse(storage.getItem('imamttae:saved')!)).toEqual(empty());
  });
  it.each([2, 99])('나중 판 v:%s는 덮어쓰지 않고 메모리에서만 작동한다', (v) => {
    const storage = memoryStorage(); const raw = JSON.stringify({ v, future: '그대로 보관' });
    storage.setItem('imamttae:saved', raw);
    const saved = createSavedStore(createSafeStore(() => storage), today);
    expect(saved.saved).toBe(false); saved.toggleWanted(place.id); saved.markVisited(place); saved.closeAlert('2026-10');
    expect(saved.visitOf(place.id)).not.toBeNull(); expect(storage.getItem('imamttae:saved')).toBe(raw);
  });
  it('옛 wanted 값이 깨져 있으면 멈추지 않고 빈 saved로 시작한다', () => {
    const storage = memoryStorage(); storage.setItem('imamttae:wanted', '{broken');
    const saved = createSavedStore(createSafeStore(() => storage), today);
    expect(saved.saved).toBe(true); expect(saved.wanted()).toEqual([]);
    expect(storage.getItem('imamttae:wanted')).toBe('{broken');
  });
  it('돌려받은 목록·도장·해별 묶음을 고쳐도 내부 기록은 바뀌지 않는다', () => {
    const { saved } = setup(); saved.toggleWanted('a'); const visit = saved.markVisited(place);
    visit.name = '바꾼 값'; saved.wanted().push('b'); saved.wantedPlaces()[0]!.savedOn = '2000-01-01';
    saved.visitOf(place.id)!.type = 'bada'; const groups = saved.visitsByYear(); groups[0]!.year = 2000; groups[0]!.visits[0]!.date = '2000-01-01';
    expect(saved.wanted()).toEqual(['a']); expect(saved.wantedPlaces()[0]?.savedOn).toBe('2026-10-04');
    expect(saved.visitOf(place.id)).toEqual({ sceneId: place.id, date: '2026-10-04', name: place.name, type: 'gyegok' });
    expect(saved.visitsByYear()[0]?.year).toBe(2026);
  });
});
