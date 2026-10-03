import { describe, expect, it } from 'vitest';
import { isYearRound, monthsForScene, sceneTier, splitByMonth, visitedMonth } from '../../src/domain/sceneTier';
import { SCENE_TYPES, isSceneTypeId } from '../../src/domain/sceneTypes';

/**
 * 사용자 결정(10/3): 사진은 '다녀온 계절'로 보여 준다.
 * - 제철(peak): 다녀온 달이 가장 좋은 때 안에 있는 장면 → 가장 좋은 때 내내 강조해서 보여 줌
 * - 기록(record): 그 밖(철 지난 방문, 일 년 내내 볼 수 있는 장면, 가장 좋은 때가 없는 장면) → 다녀온 달에만, 톤을 낮춰 보여 줌
 */
const s = (visited: string, best?: { from: number; to: number } | null) => ({ visited, best: best ?? undefined });

describe('visitedMonth: 다녀온 날에서 달 꺼내기', () => {
  it('YYYY-MM-DD와 YYYY-MM 모두', () => {
    expect(visitedMonth('2020-10-20')).toBe(10);
    expect(visitedMonth('2023-08')).toBe(8);
  });
  it('형식이 틀리면 오류', () => {
    expect(() => visitedMonth('2023/08/01')).toThrow();
  });
});

describe('isYearRound: 일 년 내내인 기간', () => {
  it('1~12월', () => expect(isYearRound({ from: 1, to: 12 })).toBe(true));
  it('해를 넘겨 12달을 다 덮는 기간(3월~2월)', () => expect(isYearRound({ from: 3, to: 2 })).toBe(true));
  it('보통 기간은 아님', () => {
    expect(isYearRound({ from: 10, to: 11 })).toBe(false);
    expect(isYearRound({ from: 12, to: 2 })).toBe(false);
  });
});

describe('sceneTier: 제철인가, 기록인가', () => {
  it('다녀온 달이 가장 좋은 때 안 → 제철', () => {
    expect(sceneTier(s('2020-10-20', { from: 10, to: 10 }))).toBe('peak');
    expect(sceneTier(s('2024-01-07', { from: 12, to: 2 }))).toBe('peak');
  });
  it('철 지나 다녀옴(8월에 본 은행나무, 가장 좋은 때 10~11월) → 기록', () => {
    expect(sceneTier(s('2020-08-25', { from: 10, to: 11 }))).toBe('record');
  });
  it('일 년 내내 볼 수 있는 장면(일출·낙조, 바다) → 기록', () => {
    expect(sceneTier(s('2019-12-05', { from: 1, to: 12 }))).toBe('record');
  });
  it('가장 좋은 때가 없는 장면 → 기록', () => {
    expect(sceneTier(s('2021-06-16'))).toBe('record');
    expect(sceneTier(s('2021-06-16', null))).toBe('record');
  });
});

describe('monthsForScene: 그 장면이 어느 달에 나오나', () => {
  it('제철 장면은 가장 좋은 때의 모든 달', () => {
    expect(monthsForScene(s('2020-11-10', { from: 10, to: 11 }))).toEqual([10, 11]);
    expect(monthsForScene(s('2023-12-17', { from: 12, to: 2 }))).toEqual([1, 2, 12]);
  });
  it('기록 장면은 다녀온 달 하나', () => {
    expect(monthsForScene(s('2020-08-25', { from: 10, to: 11 }))).toEqual([8]);
    expect(monthsForScene(s('2019-12-05', { from: 1, to: 12 }))).toEqual([12]);
  });
});

describe('splitByMonth: 그달 화면에 나올 제철·기록 나누기', () => {
  const scenes = [
    { id: 'a-danpung', ...s('2020-10-20', { from: 10, to: 11 }) },
    { id: 'b-eunhaeng-8wol', ...s('2020-08-25', { from: 10, to: 11 }) },
    { id: 'c-ilmol-10wol', ...s('2022-10-23', { from: 1, to: 12 }) },
    { id: 'd-seolgyeong', ...s('2024-01-07', { from: 12, to: 2 }) },
  ];
  it('10월: 단풍은 제철, 10월에 본 낙조는 기록, 8월에 본 은행나무는 안 나옴', () => {
    const r = splitByMonth(scenes, 10);
    expect(r.peak.map((x) => x.id)).toEqual(['a-danpung']);
    expect(r.record.map((x) => x.id)).toEqual(['c-ilmol-10wol']);
  });
  it('8월: 철 지나 본 은행나무가 기록으로 나옴', () => {
    const r = splitByMonth(scenes, 8);
    expect(r.peak).toEqual([]);
    expect(r.record.map((x) => x.id)).toEqual(['b-eunhaeng-8wol']);
  });
  it('2월: 해를 넘는 설경도 제철', () => {
    expect(splitByMonth(scenes, 2).peak.map((x) => x.id)).toEqual(['d-seolgyeong']);
  });
  it('한 장면이 같은 달에 제철과 기록 둘 다로 나오지 않음', () => {
    for (let m = 1; m <= 12; m++) {
      const r = splitByMonth(scenes, m);
      const ids = [...r.peak, ...r.record].map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('명장면 종류 13가지 (10/3 사용자 결정: 계곡·폭포, 바다 절경, 신록·초원 추가)', () => {
  it('13가지이고 id가 겹치지 않음', () => {
    expect(SCENE_TYPES).toHaveLength(13);
    expect(new Set(SCENE_TYPES.map((t) => t.id)).size).toBe(13);
  });
  it('새 종류 세 가지', () => {
    const byId = Object.fromEntries(SCENE_TYPES.map((t) => [t.id, t.label]));
    expect(byId.gyegok).toBe('계곡·폭포');
    expect(byId.bada).toBe('바다 절경');
    expect(byId.sinrok).toBe('신록·초원');
    expect(isSceneTypeId('sinrok')).toBe(true);
  });
});
