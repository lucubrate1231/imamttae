import { describe, expect, it } from 'vitest';
import { ContentFile } from '../../shared/schema/content';
import appData from '../../public/data/scenes.json';
import { MONTHS } from '../../src/domain/month';
import { SCENE_TYPES } from '../../src/domain/sceneTypes';
import * as find from '../../src/domain/find';
import type { FindInput } from '../../src/domain/find';

function scene(id: string, patch: Partial<FindInput> = {}) {
  return {
    id,
    kind: 'story',
    name: id,
    region: '강원 속초',
    types: ['danpung'] as const,
    visited: '2020-10-20',
    best: { from: 10, to: 11 },
    ...patch,
  } satisfies FindInput & { id: string };
}

const ids = (scenes: readonly { id: string }[]) => scenes.map((s) => s.id);

describe('regionOf · REGIONS: 권역을 첫 낱말로 나누기 (F3-AC7)', () => {
  it('강원 · 경상 · 전라 · 충청 · 수도권 순서와 이름', () => {
    expect(find.REGIONS).toEqual([
      { id: 'gangwon', label: '강원' },
      { id: 'gyeongsang', label: '경상' },
      { id: 'jeolla', label: '전라' },
      { id: 'chungcheong', label: '충청' },
      { id: 'sudogwon', label: '수도권' },
    ]);
  });

  it.each([
    ['강원 속초', 'gangwon'],
    ['경북 포항', 'gyeongsang'],
    ['경남 진주', 'gyeongsang'],
    ['부산 해운대', 'gyeongsang'],
    ['대구 달성', 'gyeongsang'],
    ['울산 울주', 'gyeongsang'],
    ['전북 부안', 'jeolla'],
    ['전남 순천', 'jeolla'],
    ['광주 북구', 'jeolla'],
    ['충북 제천', 'chungcheong'],
    ['충남 서산', 'chungcheong'],
    ['대전 유성', 'chungcheong'],
    ['세종 연서', 'chungcheong'],
    ['서울 종로', 'sudogwon'],
    ['경기 양평', 'sudogwon'],
    ['인천 강화', 'sudogwon'],
  ])('%s → %s', (region, want) => {
    expect(find.regionOf(region)).toBe(want);
  });

  it('앞뒤 공백과 낱말 사이의 여러 공백을 처리', () => {
    expect(find.regionOf('  경북\t포항  ')).toBe('gyeongsang');
    expect(find.regionOf('서울')).toBe('sudogwon');
  });

  it.each(['제주 서귀포', '', '   ', '알수없음 강원', '강원도 속초', '서울숲'])('%j: 모르는 첫 낱말은 null', (region) => {
    expect(find.regionOf(region)).toBeNull();
  });
});

describe('regionCounts: 있는 권역만 순서대로 세기 (F3-AC4·AC7)', () => {
  it('들어온 순서와 관계없이 권역 순서로 세고 빈 권역은 숨김', () => {
    const scenes = [
      scene('서울', { region: '서울 종로' }),
      scene('광주', { region: '광주 북구' }),
      scene('강원'),
      scene('전남', { region: '전남 순천' }),
    ];
    expect(find.regionCounts(scenes)).toEqual([
      { id: 'gangwon', label: '강원', count: 1 },
      { id: 'jeolla', label: '전라', count: 2 },
      { id: 'sudogwon', label: '수도권', count: 1 },
    ]);
  });

  it('준비 중·숨긴 장면·모르는 권역은 칩 수에서 뺌', () => {
    expect(find.regionCounts([
      scene('이야기', { hidden: false }),
      scene('준비 중', { kind: 'placeholder' }),
      scene('숨김', { hidden: true }),
      scene('알 수 없음', { kind: 'draft' }),
      scene('제주', { region: '제주 서귀포' }),
    ])).toEqual([{ id: 'gangwon', label: '강원', count: 1 }]);
  });

  it('장면이 없으면 빈 칩 목록', () => {
    expect(find.regionCounts([])).toEqual([]);
  });
});

describe('typeCounts: 풍경 13가지 이야기 수 (F3-AC4·AC5)', () => {
  it('모든 풍경을 0으로 시작하고 한 장면의 여러 풍경도 각각 셈', () => {
    const counts = find.typeCounts([
      scene('단풍과 물안개', { types: ['danpung', 'unhae'] }),
      scene('단풍'),
    ]);
    expect(counts).toEqual(Object.fromEntries(SCENE_TYPES.map(({ id }) => [
      id, id === 'danpung' ? 2 : id === 'unhae' ? 1 : 0,
    ])));
  });

  it('준비 중·숨긴 장면은 빼고 권역이 없는 이야기도 셈', () => {
    const counts = find.typeCounts([
      scene('준비 중', { kind: 'placeholder' }),
      scene('숨김', { hidden: true }),
      scene('제주 바다', { region: '제주 서귀포', types: ['bada'] }),
    ]);
    expect(counts.danpung).toBe(0);
    expect(counts.bada).toBe(1);
  });

  it('같은 장면에 같은 풍경이 반복돼도 이야기 한 곳으로 셈', () => {
    expect(find.typeCounts([scene('단풍', { types: ['danpung', 'danpung'] })]).danpung).toBe(1);
  });

  it('빈 목록에서도 13가지가 모두 0', () => {
    expect(find.typeCounts([])).toEqual(Object.fromEntries(SCENE_TYPES.map(({ id }) => [id, 0])));
  });
});

describe('monthsForType: 사진의 계절에 맞는 달 표시 (F3-AC2·AC4)', () => {
  it('제철 기간을 합쳐 겹치는 달을 한 번만 오름차순으로 표시', () => {
    const scenes = [
      scene('겨울', { visited: '2024-01', best: { from: 12, to: 2 }, types: ['seolgyeong'] }),
      scene('늦겨울', { visited: '2024-02-10', best: { from: 2, to: 3 }, types: ['seolgyeong'] }),
      scene('단풍'),
    ];
    expect(find.monthsForType(scenes, 'seolgyeong')).toEqual([1, 2, 3, 12]);
  });

  it('철 지나 방문·일 년 내내·기간 없음은 다녀온 달로 표시', () => {
    expect(find.monthsForType([
      scene('여름 방문', { visited: '2020-08', best: { from: 10, to: 11 } }),
      scene('연중', { visited: '2020-06-01', best: { from: 1, to: 12 } }),
      scene('기간 없음', { visited: '2020-04', best: null }),
      scene('기간 생략', { visited: '2020-03', best: undefined }),
    ], 'danpung')).toEqual([3, 4, 6, 8]);
  });

  it('다른 풍경·준비 중·숨긴 장면은 달 표시에서 뺌', () => {
    expect(find.monthsForType([
      scene('다른 풍경', { types: ['bada'] }),
      scene('준비 중', { kind: 'placeholder' }),
      scene('숨김', { hidden: true }),
    ], 'danpung')).toEqual([]);
    expect(find.monthsForType([], 'danpung')).toEqual([]);
  });
});

describe('findScenes: 풍경·권역 고르기 (F3-AC2·AC4·AC7)', () => {
  const scenes = [
    scene('강원 단풍'),
    scene('전라 단풍', { region: '전북 정읍', visited: '2020-11', best: { from: 11, to: 11 } }),
    scene('강원 바다', { types: ['bada'], best: { from: 1, to: 12 } }),
    scene('제주 단풍', { region: '제주 서귀포' }),
    scene('준비 중', { kind: 'placeholder' }),
    scene('숨김', { hidden: true }),
    scene('다른 종류', { kind: 'draft' }),
  ];

  it('선택을 생략하거나 null로 두면 모든 공개 이야기를 두 갈래로 나눔', () => {
    const want = { peak: ['강원 단풍', '제주 단풍', '전라 단풍'], record: ['강원 바다'] };
    for (const opts of [{ month: 10 }, { month: 10, type: null, region: null }]) {
      const result = find.findScenes(scenes, opts);
      expect({ peak: ids(result.peak), record: ids(result.record) }).toEqual(want);
    }
  });

  it('풍경만 고르면 다른 달의 장면과 권역 없는 장면도 포함', () => {
    const result = find.findScenes(scenes, { type: 'danpung', month: 10 });
    expect(ids(result.peak)).toEqual(['강원 단풍', '제주 단풍', '전라 단풍']);
    expect(result.record).toEqual([]);
  });

  it('권역만 고르면 그 권역의 모든 풍경을 포함', () => {
    const result = find.findScenes(scenes, { region: 'gangwon', month: 1 });
    expect(ids(result.peak)).toEqual(['강원 단풍']);
    expect(ids(result.record)).toEqual(['강원 바다']);
  });

  it('풍경과 권역을 함께 고르면 둘 다 맞는 장면만 포함', () => {
    expect(ids(find.findScenes(scenes, { type: 'danpung', region: 'gangwon', month: 10 }).peak)).toEqual(['강원 단풍']);
    expect(find.findScenes(scenes, { type: 'bada', region: 'jeolla', month: 10 })).toEqual({ peak: [], record: [] });
  });

  it('빈 목록이나 해당 풍경이 없으면 두 갈래 모두 빈 목록', () => {
    expect(find.findScenes([], { month: 10 })).toEqual({ peak: [], record: [] });
    expect(find.findScenes(scenes, { type: 'beotkkot', month: 10 })).toEqual({ peak: [], record: [] });
  });
});

describe('findScenes: 제철과 작가 부부 방문 정렬 (F3-AC3)', () => {
  it('10월 단풍: 설악 주전골 → 내장산', () => {
    const scenes = [
      scene('naejang', { name: '내장산', visited: '2021-11', best: { from: 11, to: 11 } }),
      scene('seorak', { name: '설악 주전골', best: { from: 10, to: 10 } }),
    ];
    expect(ids(find.findScenes(scenes, { type: 'danpung', month: 10 }).peak)).toEqual(['seorak', 'naejang']);
  });

  it('이미 제철인 곳은 0개월, 같으면 이름 가나다순', () => {
    const scenes = [
      scene('next', { name: '가장 빠른 이름', visited: '2020-12', best: { from: 12, to: 12 } }),
      scene('b', { name: '나무', best: { from: 10, to: 11 } }),
      scene('a', { name: '가을', visited: '2020-09', best: { from: 9, to: 11 } }),
    ];
    expect(ids(find.findScenes(scenes, { month: 11 }).peak)).toEqual(['a', 'b', 'next']);
  });

  it.each([
    [12, ['winter', 'spring', 'autumn']],
    [1, ['winter', 'spring', 'autumn']],
    [2, ['winter', 'spring', 'autumn']],
    [3, ['spring', 'autumn', 'winter']],
    [11, ['winter', 'spring', 'autumn']],
  ])('%i월: 해를 넘는 제철 기간의 가까운 순서', (month, want) => {
    const scenes = [
      scene('autumn', { visited: '2020-10', best: { from: 10, to: 10 } }),
      scene('spring', { visited: '2020-04', best: { from: 3, to: 4 } }),
      scene('winter', { visited: '2020-01', best: { from: 12, to: 2 } }),
    ];
    expect(ids(find.findScenes(scenes, { month }).peak)).toEqual(want);
  });

  it('기록은 추천 시기가 아닌 다녀온 달까지의 거리, 같으면 가나다순', () => {
    const scenes = [
      scene('past', { visited: '2020-08', best: { from: 10, to: 11 } }),
      scene('jan', { visited: '2020-01', best: undefined }),
      scene('b', { name: '나무', visited: '2020-10', best: { from: 1, to: 12 } }),
      scene('a', { name: '가을', visited: '2020-10', best: null }),
      scene('nov', { visited: '2020-11', best: { from: 3, to: 2 } }),
    ];
    expect(ids(find.findScenes(scenes, { month: 10 }).record)).toEqual(['a', 'b', 'nov', 'jan', 'past']);
  });

  it('제철 여부는 기존 기준대로: 철 지난 방문·연중·기간 없음은 기록', () => {
    const scenes = [
      scene('peak'),
      scene('past', { visited: '2020-08' }),
      scene('year-round', { best: { from: 1, to: 12 } }),
      scene('no-window', { best: undefined }),
    ];
    const result = find.findScenes(scenes, { month: 8 });
    expect(ids(result.peak)).toEqual(['peak']);
    expect(new Set(ids(result.record))).toEqual(new Set(['past', 'year-round', 'no-window']));
  });

  it('정렬해도 원래 배열을 바꾸지 않고 장면의 추가 값과 객체를 보존', () => {
    const a = Object.freeze({ ...scene('a', { name: '가을' }), memo: '화면이 가져갈 값' });
    const b = Object.freeze({ ...scene('b', { name: '나무' }), memo: '다른 값' });
    const scenes = Object.freeze([b, a]);
    const first = find.findScenes(scenes, { month: 10 });
    expect(first.peak).toEqual([a, b]);
    expect(first.peak[0]).toBe(a);
    expect(first.peak[0]?.memo).toBe('화면이 가져갈 값');
    expect(scenes).toEqual([b, a]);
    expect(find.findScenes(scenes, { month: 10 })).toEqual(first);
    expect(find.findScenes([a, b], { month: 10 })).toEqual(first);
  });
});

describe('실제 앱 데이터의 풍경 찾기 규칙 (F3-AC2·AC3·AC4·AC7)', () => {
  it('모든 공개 이야기의 권역이 있고 칩 수의 합은 이야기 수와 같음', () => {
    const stories = ContentFile.parse(appData).scenes.filter((s) => s.kind === 'story').filter((s) => !s.hidden);
    expect(stories.length).toBeGreaterThan(0);
    expect(stories.every((s) => find.regionOf(s.region) !== null)).toBe(true);
    expect(find.regionCounts(stories).reduce((sum, r) => sum + r.count, 0)).toBe(stories.length);
  });

  it('모든 달에서 누락·중복 없이 나누고 풍경 수와 고른 이야기 수가 같음', () => {
    const stories = ContentFile.parse(appData).scenes.filter((s) => s.kind === 'story').filter((s) => !s.hidden);
    const counts = find.typeCounts(stories);
    for (const month of MONTHS) {
      const all = find.findScenes(stories, { month });
      const selectedIds = ids([...all.peak, ...all.record]);
      expect(new Set(selectedIds).size).toBe(stories.length);
      expect(selectedIds).toHaveLength(stories.length);
      for (const { id: type } of SCENE_TYPES) {
        const selected = find.findScenes(stories, { type, month });
        expect(selected.peak.length + selected.record.length).toBe(counts[type]);
      }
    }
  });
});
