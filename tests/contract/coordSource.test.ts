import { describe, expect, it } from 'vitest';
import drafts from '../../content/scenes/drafts.json';

/** 좌표 출처(coordSource) — 카카오 검색 좌표는 대안이 정해지면 한꺼번에 바꾸므로 모든 장면에 적혀 있어야 함(법무 점검 1번) */
describe('좌표 출처(계약)', () => {
  it('모든 장면에 coordSource가 있음 — 새 장면을 만들 때 빠뜨리지 않기', () => {
    const missing = drafts.scenes.filter((s) => !(s as { coordSource?: string }).coordSource).map((s) => s.id);
    expect(missing).toEqual([]);
  });
});
