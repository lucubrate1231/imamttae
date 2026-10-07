import { describe, expect, it } from 'vitest';
import { mergeCandidates, scenesToSearch } from '../../pipeline/places/candidates';

/** 좌표 후보 다시 만들기(10/7): 앱 데이터에 아직 없는 새 초안 장면도 찾고, 이미 있는 후보는 그대로 둠 */
const drafts = [
  { id: 's-001', kind: 'story', name: '가', region: '경북 포항' },
  { id: 's-002', kind: 'story', name: '나', region: '경남 함안' },
  { id: 's-003', kind: 'story', name: '숨김', region: '전남 구례', hidden: true },
  { id: 'p-001', kind: 'placeholder', name: '준비 중', region: '' },
  { id: 's-004', kind: 'story', name: '라', region: '경북 경주' },
];
const old = [{ id: 's-001', name: '가', region: '경북 포항', spot: null, parking: [] }];

describe('scenesToSearch', () => {
  it('초안의 이야기 장면 중 후보가 아직 없는 것만(숨김·준비 중 글 빼고)', () => {
    expect(scenesToSearch(drafts, old).map((s) => s.id)).toEqual(['s-002', 's-004']);
  });
  it('all이면 이미 후보가 있는 장면도 다시 찾음', () => {
    expect(scenesToSearch(drafts, old, { all: true }).map((s) => s.id)).toEqual(['s-001', 's-002', 's-004']);
  });
  it('ids를 주면 그 장면만(숨긴 장면이라도 이름을 집어 주면 찾음)', () => {
    expect(scenesToSearch(drafts, old, { ids: ['s-003', 's-004'] }).map((s) => s.id)).toEqual(['s-003', 's-004']);
  });
});

describe('mergeCandidates', () => {
  it('새로 찾은 것을 더하고 같은 장면은 새 값으로, 순서는 초안 순서 · 초안에 없는 옛 후보는 그대로 끝에', () => {
    const fresh = [
      { id: 's-004', name: '라', region: '경북 경주', spot: null, parking: [] },
      { id: 's-001', name: '가', region: '경북 포항', spot: { title: '새' }, parking: [] },
    ];
    const gone = { id: 's-999', name: '빠진 장면', region: '', spot: null, parking: [] };
    const merged = mergeCandidates([...old, gone], fresh, drafts);
    expect(merged.map((c) => c.id)).toEqual(['s-001', 's-004', 's-999']);
    expect(merged[0]!.spot).toEqual({ title: '새' });
  });
});
