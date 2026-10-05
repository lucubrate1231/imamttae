import { describe, expect, it } from 'vitest';
import { applyPicked, type Picked } from '../../pipeline/places/apply';

/** 좌표 확인 페이지에서 정한 값 → 장면 초안(카카오 좌표 바꾸기, docs/kakao-local-data.md ③) */
const base = {
  id: 's-a',
  spot: { lat: 35.1, lng: 127.1 },
  dest: { name: '옛 주차장', lat: 35.11, lng: 127.11, kind: 'parking' as const },
  coordSource: 'kakao-search' as const,
};

describe('applyPicked', () => {
  it('장면 위치·목적지·이름·종류를 바꾸고, 출처와 번호를 남김', () => {
    const picked: Picked = {
      's-a': {
        spot: { lat: 0, lng: 0, source: 'public-data', ref: 'tour:649968' },
        dest: { name: '내장산 주차장', kind: 'parking', lat: 35.4801, lng: 126.9011, source: 'public-data', ref: 'parking:345-3-000171' },
      },
    };
    const [s] = applyPicked([base], picked).scenes;
    expect(s).toMatchObject({
      spot: { lat: 0, lng: 0 },
      dest: { name: '내장산 주차장', lat: 35.4801, lng: 126.9011, kind: 'parking' },
      coordSource: 'public-data',
      coordRef: { spot: 'tour:649968', dest: 'parking:345-3-000171' },
    });
  });

  it('둘 중 하나라도 직접 찍었으면 coordSource는 manual', () => {
    const picked: Picked = {
      's-a': { spot: { lat: 1, lng: 2, source: 'public-data', ref: 'tour:1' }, dest: { name: '입구', kind: 'entrance', lat: 3, lng: 4, source: 'manual', ref: null } },
    };
    const [s] = applyPicked([base], picked).scenes;
    expect(s!.coordSource).toBe('manual');
    expect(s!.coordRef).toEqual({ spot: 'tour:1', dest: 'manual' });
  });

  it('목적지 이름이 비었거나 둘 중 하나가 없으면 바꾸지 않고 남은 곳으로 셈(카카오 좌표 그대로)', () => {
    const picked: Picked = { 's-a': { spot: { lat: 1, lng: 2, source: 'manual', ref: null }, dest: { name: '', kind: 'parking', lat: 3, lng: 4, source: 'manual', ref: null } } };
    const out = applyPicked([base], picked);
    expect(out.scenes[0]).toEqual(base);
    expect(out.changed).toEqual([]);
    expect(out.remaining).toEqual(['s-a']);
  });

  it('바꾼 곳·남은 곳(kakao-search) 목록', () => {
    const b = { ...base, id: 's-b' };
    const picked: Picked = { 's-a': { spot: { lat: 1, lng: 2, source: 'manual', ref: null }, dest: { name: '주차장', kind: 'parking', lat: 3, lng: 4, source: 'manual', ref: null } } };
    const out = applyPicked([base, b], picked);
    expect(out.changed).toEqual(['s-a']);
    expect(out.remaining).toEqual(['s-b']);
  });
});
