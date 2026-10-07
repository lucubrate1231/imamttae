import { describe, expect, it } from 'vitest';
import { ContentFile } from '../../shared/schema/content';
import appData from '../../public/data/scenes.json';
import { inWindow, MONTHS } from '../../src/domain/month';
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
  it('강원 · 경상 · 전라 · 충청 · 수도권 · 제주 순서와 이름(제주는 디자인 #55)', () => {
    expect(find.REGIONS).toEqual([
      { id: 'gangwon', label: '강원' },
      { id: 'gyeongsang', label: '경상' },
      { id: 'jeolla', label: '전라' },
      { id: 'chungcheong', label: '충청' },
      { id: 'sudogwon', label: '수도권' },
      { id: 'jeju', label: '제주' },
    ]);
  });

  it('제주·서귀포는 제주 권역, 제주 장면이 없으면 칩에 나오지 않음(#55)', () => {
    expect(find.regionOf('제주 서귀포')).toBe('jeju');
    expect(find.regionOf('서귀포')).toBe('jeju');
    expect(find.regionCounts([{ kind: 'story', region: '강원 양양', types: ['danpung'], name: '가', visited: '2024-10-10', best: { from: 10, to: 10 } }]).map((r) => r.id)).toEqual(['gangwon']);
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

  it.each(['독도 울릉', '', '   ', '알수없음 강원', '강원도 속초', '서울숲'])('%j: 모르는 첫 낱말은 null', (region) => {
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
      scene('독도', { region: '독도 울릉' }),
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
      scene('독도 바다', { region: '독도 울릉', types: ['bada'] }),
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

describe('typeWhen: 추천 시기로 볼 수 있는 때 계산 (D16·D17, F3-AC2)', () => {
  it('다녀온 달이 달라도 추천 시기를 합치며 null·생략한 추천 시기는 뺀다', () => {
    expect(find.typeWhen([
      scene('여름 사진', { visited: '2020-08', best: { from: 10, to: 10 } }),
      scene('봄 사진', { visited: '2020-03', best: { from: 11, to: 11 } }),
      scene('기간 없음', { best: null }), scene('기간 생략', { best: undefined }),
    ], 'danpung')).toEqual({ kind: 'range', from: 10, to: 11 });
  });
  it('겹치거나 맞닿은 추천 시기를 범위 하나로 합친다', () => {
    expect(find.typeWhen([
      scene('봄', { best: { from: 3, to: 5 } }),
      scene('늦봄', { best: { from: 5, to: 6 } }),
      scene('여름', { best: { from: 7, to: 8 } }),
    ], 'danpung')).toEqual({ kind: 'range', from: 3, to: 8 });
  });
  it('해를 넘는 추천 시기도 하나로 합친다', () => {
    expect(find.typeWhen([
      scene('겨울', { best: { from: 11, to: 1 } }),
      scene('늦겨울', { best: { from: 1, to: 2 } }),
    ], 'danpung')).toEqual({ kind: 'range', from: 11, to: 2 });
  });
  it('다른 풍경·숨긴 장면·준비 중·미발행 장면은 분자와 분모에서 모두 뺀다', () => {
    expect(find.typeWhen([
      scene('연중', { best: { from: 1, to: 12 } }),
      scene('다른 풍경', { types: ['bada'] }),
      scene('숨김', { hidden: true }), scene('준비 중', { kind: 'placeholder' }),
      scene('미발행', { kind: 'draft' }),
    ], 'danpung')).toEqual({ kind: 'always' });
  });
  it('일 년 내내가 절반 넘으면 언제나이며 해를 넘는 연중 범위도 센다', () => {
    expect(find.typeWhen([
      scene('연중 1', { best: { from: 1, to: 12 } }),
      scene('연중 2', { best: { from: 3, to: 2 } }), scene('가을'),
    ], 'danpung')).toEqual({ kind: 'always' });
  });
  it('정확히 절반이면 언제나가 아니고 연중 장면은 합친 달에서 뺀다', () => {
    expect(find.typeWhen([
      scene('연중', { best: { from: 1, to: 12 } }), scene('가을'),
    ], 'danpung')).toEqual({ kind: 'range', from: 10, to: 11 });
  });
  it('추천 시기 없는 장면도 전체 장면 분모에 포함한다', () => {
    expect(find.typeWhen([
      scene('연중', { best: { from: 1, to: 12 } }), scene('가을'),
      scene('추천 없음', { best: null }),
    ], 'danpung')).toEqual({ kind: 'range', from: 10, to: 11 });
  });
  it('연중이 소수이며 나머지 추천 시기가 없으면 none이다', () => {
    expect(find.typeWhen([
      scene('연중', { best: { from: 1, to: 12 } }),
      scene('없음 1', { best: null }), scene('없음 2', { best: undefined }),
    ], 'danpung')).toEqual({ kind: 'none' });
  });
  it('추천 시기를 합쳐 12달을 모두 덮으면 언제나다', () => {
    expect(find.typeWhen([
      scene('상반기', { best: { from: 1, to: 6 } }),
      scene('하반기', { best: { from: 7, to: 12 } }),
    ], 'danpung')).toEqual({ kind: 'always' });
  });
  it('끊긴 달은 달별 합계가 아니라 겹치는 장면 수가 많은 범위를 고른다', () => {
    expect(find.typeWhen([
      scene('긴 범위 한 곳', { best: { from: 3, to: 6 } }),
      scene('짧은 범위 1', { best: { from: 10, to: 10 } }),
      scene('짧은 범위 2', { best: { from: 10, to: 10 } }),
    ], 'danpung')).toEqual({ kind: 'range', from: 10, to: 10 });
  });
  it('끊긴 범위의 장면 수가 같으면 달 수가 긴 범위를 고른다', () => {
    expect(find.typeWhen([
      scene('짧은 봄', { best: { from: 3, to: 3 } }),
      scene('긴 가을', { best: { from: 9, to: 11 } }),
    ], 'danpung')).toEqual({ kind: 'range', from: 9, to: 11 });
  });
  it('장면 수와 달 수가 모두 같으면 시작 달이 1월에 가까운 범위를 고른다', () => {
    expect(find.typeWhen([
      scene('가을', { best: { from: 9, to: 10 } }),
      scene('봄', { best: { from: 3, to: 4 } }),
    ], 'danpung')).toEqual({ kind: 'range', from: 3, to: 4 });
  });
  it('끊긴 범위에서도 겨울을 12월·1월로 나누지 않고 장면 한 곳을 한 번 센다', () => {
    expect(find.typeWhen([
      scene('겨울 1', { best: { from: 12, to: 2 } }),
      scene('겨울 2', { best: { from: 1, to: 2 } }),
      scene('여름', { best: { from: 6, to: 9 } }),
    ], 'danpung')).toEqual({ kind: 'range', from: 12, to: 2 });
  });
  it('이야기나 추천 시기가 없으면 none이며 빈 배열도 처리한다', () => {
    expect(find.typeWhen([], 'danpung')).toEqual({ kind: 'none' });
    expect(find.typeWhen([scene('추천 없음', { best: null })], 'danpung')).toEqual({ kind: 'none' });
    expect(find.typeWhen([scene('다른 종류')], 'bada')).toEqual({ kind: 'none' });
  });
});

describe('whenStatus: 이번 달과 추천 범위의 관계 (F3-AC2)', () => {
  it.each([
    [{ kind: 'always' }, 10, 'always'], [{ kind: 'none' }, 10, 'none'],
    [{ kind: 'range', from: 10, to: 11 }, 10, 'now'],
    [{ kind: 'range', from: 10, to: 11 }, 11, 'now'],
    [{ kind: 'range', from: 11, to: 2 }, 10, 'soon'],
    [{ kind: 'range', from: 11, to: 2 }, 12, 'now'],
    [{ kind: 'range', from: 11, to: 2 }, 1, 'now'],
    [{ kind: 'range', from: 11, to: 2 }, 2, 'now'],
    [{ kind: 'range', from: 11, to: 2 }, 3, 'later'],
    [{ kind: 'range', from: 3, to: 3 }, 10, 'later'],
    [{ kind: 'range', from: 1, to: 1 }, 12, 'soon'],
    [{ kind: 'range', from: 3, to: 3 }, 3, 'now'],
  ] as const)('%j, %i월 → %s', (w, month, status) => {
    expect(find.whenStatus(w, month)).toBe(status);
  });
});

describe('typeGroups: 고르기 화면 묶음 (D22·D61, F3-AC1·AC5)', () => {
  it('D61 ①: 볼 수 있는 때(합친 달 범위)가 짧은 풍경 먼저 — 장면이 더 많아도 긴 운해는 뒤로', () => {
    const g = find.typeGroups([
      scene('운해 1', { types: ['unhae'], best: { from: 4, to: 11 } }), scene('운해 2', { types: ['unhae'], best: { from: 4, to: 11 } }),
      scene('운해 3', { types: ['unhae'], best: { from: 4, to: 11 } }),
      scene('단풍'),
    ], 10);
    expect(g.good).toEqual([{ type: 'danpung', count: 1 }, { type: 'unhae', count: 3 }]);
  });
  it('D61 ②: 길이가 같으면 고른 달부터 먼저 끝나는 풍경 먼저(12월→1월도 이어서 셈)', () => {
    const g = find.typeGroups([
      scene('단풍 1'), scene('단풍 2'), // 10~11
      scene('억새', { types: ['eoksae'], best: { from: 9, to: 10 } }), // 9~10 — 10월에 끝남
    ], 10);
    expect(g.good.map((x) => x.type)).toEqual(['eoksae', 'danpung']);
    const winter = find.typeGroups([
      scene('설경', { types: ['seolgyeong'], best: { from: 12, to: 1 } }),
      scene('매화', { types: ['maehwa'], best: { from: 11, to: 12 } }),
    ], 12);
    expect(winter.good.map((x) => x.type)).toEqual(['maehwa', 'seolgyeong']);
  });
  it('D61 ③④: 길이·끝나는 때가 같으면 그달 장면이 많은 순, 그것도 같으면 표 순서로 놓고 여러 풍경도 각각 센다', () => {
    const g = find.typeGroups([
      scene('단풍 1'), scene('단풍 2'),
      scene('매화와 단풍', { types: ['maehwa', 'danpung', 'danpung'] }),
      scene('벚꽃', { types: ['beotkkot'] }),
      scene('억새 다른 계절 사진', { types: ['eoksae'], visited: '2020-08' }),
      scene('숨김', { hidden: true }), scene('준비 중', { kind: 'placeholder' }),
    ], 10);
    expect(g.good).toEqual([
      { type: 'danpung', count: 3 }, { type: 'maehwa', count: 1 },
      { type: 'beotkkot', count: 1 }, { type: 'eoksae', count: 1 },
    ]);
  });
  it('언제나 풍경은 good에 넣지 않고 표 순서로 둔다', () => {
    const g = find.typeGroups([
      scene('바다', { types: ['bada'], best: { from: 1, to: 12 } }),
      scene('일출 1', { types: ['ilchul'], best: { from: 3, to: 2 } }),
      scene('일출 2', { types: ['ilchul'], best: { from: 1, to: 12 } }),
      scene('겨울 일출', { types: ['ilchul'], best: { from: 10, to: 11 } }),
      scene('상반기', { types: ['unhae'], best: { from: 1, to: 6 } }),
      scene('하반기', { types: ['unhae'], best: { from: 7, to: 12 } }),
    ], 10);
    expect(g.good).toEqual([]);
    expect(g.always).toEqual(['unhae', 'ilchul', 'bada']);
  });
  it('연중 장면은 good 수에서 빼고 추천 없는 이야기·이야기 없는 풍경을 구별한다', () => {
    const g = find.typeGroups([
      scene('연중', { types: ['sinrok'], best: { from: 1, to: 12 } }),
      scene('신록 봄', { types: ['sinrok'], best: { from: 5, to: 6 } }),
      scene('단풍 연중', { best: { from: 1, to: 12 } }), scene('단풍 가을'),
      scene('없는 시기', { types: ['yeoreumkkot'], best: undefined }),
      scene('없는 시기 2', { types: ['eoksae'], best: null }),
      scene('숨긴 매화', { types: ['maehwa'], hidden: true }),
      scene('준비 중 벚꽃', { types: ['beotkkot'], kind: 'placeholder' }),
    ], 10);
    expect(g.good).toEqual([{ type: 'danpung', count: 1 }]);
    expect(g.always).toEqual([]);
    expect(g.other).toEqual(['sinrok', 'yeoreumkkot', 'eoksae']);
    expect(g.empty).toContain('maehwa'); expect(g.empty).toContain('beotkkot');
  });
  it('다른 때는 다음 달부터 가까운 시작 달 순이고 같은 달은 표 순서다', () => {
    const g = find.typeGroups([
      scene('벚꽃', { types: ['beotkkot'], best: { from: 3, to: 4 } }),
      scene('매화', { types: ['maehwa'], best: { from: 3, to: 3 } }),
      scene('겨울', { types: ['seolgyeong'], best: { from: 11, to: 2 } }),
      scene('여름꽃', { types: ['yeoreumkkot'], best: { from: 7, to: 8 } }),
    ], 10);
    expect(g.other).toEqual(['seolgyeong', 'maehwa', 'beotkkot', 'yeoreumkkot']);
  });
  it('12월에는 다음 1월부터 가까운 시작 달 순서로 둔다', () => {
    const g = find.typeGroups([
      scene('여름', { types: ['yeoreumkkot'], best: { from: 7, to: 8 } }),
      scene('1월', { types: ['seolgyeong'], best: { from: 1, to: 2 } }),
      scene('봄', { types: ['maehwa'], best: { from: 3, to: 3 } }),
    ], 12);
    expect(g.other).toEqual(['seolgyeong', 'maehwa', 'yeoreumkkot']);
  });
  it('대표로 고른 범위 밖이라도 이번 달에 좋은 실제 장면이 있으면 good에 넣는다', () => {
    const scenes = [
      scene('봄 1', { best: { from: 3, to: 4 } }), scene('봄 2', { best: { from: 3, to: 4 } }),
      scene('가을', { best: { from: 10, to: 11 } }),
    ];
    expect(find.typeWhen(scenes, 'danpung')).toEqual({ kind: 'range', from: 3, to: 4 });
    expect(find.typeGroups(scenes, 10).good).toEqual([{ type: 'danpung', count: 1 }]);
  });
  it('빈 목록이면 모든 풍경이 표 순서로 empty에만 들어간다', () => {
    expect(find.typeGroups([], 10)).toEqual({
      good: [], always: [], other: [], empty: SCENE_TYPES.map((t) => t.id),
    });
  });
  it('계산은 동결한 입력과 추천 기간을 바꾸지 않으며 결과를 고쳐도 다음 계산에 영향이 없다', () => {
    const a = Object.freeze(scene('봄', { best: Object.freeze({ from: 3, to: 4 }) }));
    const b = Object.freeze(scene('가을'));
    const scenes = Object.freeze([b, a]);
    const expected = find.typeGroups(scenes, 10);
    const w = find.typeWhen(scenes, 'danpung');
    if (w.kind === 'range') w.from = 12;
    const changed = find.typeGroups(scenes, 10); changed.good[0]!.count = 99;
    changed.empty.pop();
    expect(find.typeGroups(scenes, 10)).toEqual(expected);
    expect(find.typeWhen(scenes, 'danpung')).toEqual({ kind: 'range', from: 3, to: 4 });
    expect(scenes).toEqual([b, a]);
  });
});

describe('findScenes: 풍경·권역 고르기 (F3-AC2·AC4·AC7)', () => {
  const scenes = [
    scene('강원 단풍'),
    scene('전라 단풍', { region: '전북 정읍', visited: '2020-11', best: { from: 11, to: 11 } }),
    scene('강원 바다', { types: ['bada'], best: { from: 1, to: 12 } }),
    scene('제주 단풍', { region: '독도 울릉' }),
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

  it('지금 좋은 곳은 곧 시작하는 곳보다 앞이며 같은 끝 달이면 이름 가나다순', () => {
    const scenes = [
      scene('next', { name: '가장 빠른 이름', visited: '2020-12', best: { from: 12, to: 12 } }),
      scene('b', { name: '나무', best: { from: 10, to: 11 } }),
      scene('a', { name: '가을', visited: '2020-09', best: { from: 9, to: 11 } }),
    ];
    expect(ids(find.findScenes(scenes, { month: 11 }).peak)).toEqual(['a', 'b', 'next']);
  });

  it('지금 좋은 곳 안에서는 이름보다 추천 시기가 먼저 끝나는 곳이 앞이다', () => {
    const scenes = [
      scene('late', { name: '가장 앞 이름', best: { from: 10, to: 11 } }),
      scene('early', { name: '나중 이름', best: { from: 10, to: 10 } }),
      scene('soon', { name: '가을', visited: '2020-11', best: { from: 11, to: 11 } }),
    ];
    expect(ids(find.findScenes(scenes, { month: 10 }).peak)).toEqual(['early', 'late', 'soon']);
  });
  it.each([12, 1])('%i월: 겨울의 지금 좋은 곳도 끝 달까지 남은 달 수로 정렬한다', (month) => {
    const scenes = [
      scene('feb', { name: '가장 앞 이름', visited: '2020-12', best: { from: 11, to: 2 } }),
      scene('jan', { name: '나중 이름', visited: '2020-12', best: { from: 12, to: 1 } }),
    ];
    expect(ids(find.findScenes(scenes, { month }).peak)).toEqual(['jan', 'feb']);
  });
  it('그 밖의 제철 장면은 끝 달이 아니라 시작까지 가까운 순, 같으면 이름순이다', () => {
    const scenes = [
      scene('late', { visited: '2020-01', best: { from: 1, to: 1 } }),
      scene('b', { name: '나무', visited: '2020-12', best: { from: 11, to: 2 } }),
      scene('a', { name: '가을', visited: '2020-11', best: { from: 11, to: 11 } }),
    ];
    expect(ids(find.findScenes(scenes, { month: 10 }).peak)).toEqual(['a', 'b', 'late']);
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
  it('실제 추천 시기는 단풍·억새 10~11, 운해 4~11, 설경 11~2, 일출·바다 언제나다', () => {
    const scenes = ContentFile.parse(appData).scenes.filter((s) => s.kind === 'story');
    expect(find.typeWhen(scenes, 'danpung')).toEqual({ kind: 'range', from: 10, to: 11 });
    expect(find.typeWhen(scenes, 'eoksae')).toEqual({ kind: 'range', from: 10, to: 11 });
    expect(find.typeWhen(scenes, 'unhae')).toEqual({ kind: 'range', from: 4, to: 11 });
    expect(find.typeWhen(scenes, 'seolgyeong')).toEqual({ kind: 'range', from: 11, to: 2 });
    expect(find.typeWhen(scenes, 'ilchul')).toEqual({ kind: 'always' });
    expect(find.typeWhen(scenes, 'bada')).toEqual({ kind: 'always' });
  });
  it('10월(D61): 그때만 보는 풍경 먼저 — 가을꽃(9~10월, 10월에 끝남) → 단풍 → 억새 → 계곡 → 운해 → 신록, 언제나는 일출·바다, 다른 때는 겨울부터다', () => {
    const scenes = ContentFile.parse(appData).scenes.filter((s) => s.kind === 'story');
    const g = find.typeGroups(scenes, 10);
    expect(g.good.map((x) => x.type)).toEqual(['kkotmureut', 'danpung', 'eoksae', 'gyegok', 'unhae', 'sinrok']);
    expect(g.always).toEqual(['ilchul', 'bada']);
    expect(g.other).toEqual(['seolgyeong', 'maehwa', 'beotkkot', 'jindallae', 'yeoreumkkot']);
  });
  it('5월(D61): 진달래·철쭉 → 벚꽃 → 여름꽃 → 계곡 → 신록 → 운해', () => {
    const scenes = ContentFile.parse(appData).scenes.filter((s) => s.kind === 'story');
    expect(find.typeGroups(scenes, 5).good.map((x) => x.type)).toEqual(['jindallae', 'beotkkot', 'yeoreumkkot', 'gyegok', 'sinrok', 'unhae']);
  });
  it('모든 달에서 모든 풍경은 정확히 한 묶음에 들어가고 good 수는 실제 추천 시기 장면 수다', () => {
    const scenes = ContentFile.parse(appData).scenes.filter((s) => s.kind === 'story');
    const stories = scenes.filter((s) => !s.hidden);
    const allTypes = SCENE_TYPES.map((t) => t.id);
    for (const month of MONTHS) {
      const g = find.typeGroups(scenes, month);
      const grouped = [...g.good.map((x) => x.type), ...g.always, ...g.other, ...g.empty];
      expect(grouped).toHaveLength(allTypes.length);
      expect(new Set(grouped)).toEqual(new Set(allTypes));
      expect(g.empty).toEqual(allTypes.filter((type) => !stories.some((s) => s.types.includes(type))));
      for (const row of g.good) {
        const expected = stories.filter((s) => s.types.includes(row.type) && s.best
          && !MONTHS.every((m) => inWindow(m, s.best!)) && inWindow(month, s.best));
        expect(row.count).toBe(expected.length); expect(row.count).toBeGreaterThan(0);
        expect(find.typeWhen(scenes, row.type).kind).not.toBe('always');
      }
      for (const { id: type } of SCENE_TYPES) {
        const peak = find.findScenes(scenes, { type, month }).peak;
        const now = peak.filter((s) => inWindow(month, s.best!));
        const until = now.map((s) => (s.best!.to - month + 12) % 12);
        expect(until).toEqual([...until].sort((a, b) => a - b));
      }
    }
  });
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
