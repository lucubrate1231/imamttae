import { beforeEach, describe, expect, it } from 'vitest';
import { ContentFile, type StoryScene } from '../../shared/schema/content';
import appData from '../../public/data/scenes.json';
import { story, placeholder } from '../fixtures/homeScenes';
import { MONTHS } from '../../src/domain/month';

let savedOrder: typeof import('../../src/domain/saved').savedOrder;
let alertScenes: typeof import('../../src/domain/saved').alertScenes;
beforeEach(async () => { ({ savedOrder, alertScenes } = await import('../../src/domain/saved')); });
function scene(id: string, from: number, to: number, name = id): StoryScene {
  return story(id, { name, visited: '2020-08-01', best: { from, to, note: '' } });
}

describe('지금 가기 좋은 순과 상태 (F4-AC2·12)', () => {
  it('지금 → 언제나 → 곧 → 그 밖 → 볼 수 없음 순으로 둔다', () => {
    const scenes = [scene('later', 3, 4), scene('soon', 11, 12), scene('always', 1, 12), scene('now', 10, 10)];
    const rows = savedOrder(scenes, ['missing', 'later', 'soon', 'always', 'now'], 10);
    expect(rows.map((row) => row.sceneId)).toEqual(['now', 'always', 'soon', 'later', 'missing']);
    expect(rows.map((row) => row.status)).toEqual([
      { kind: 'now', until: 10 }, { kind: 'always' }, { kind: 'soon', from: 11 }, { kind: 'later', from: 3 }, { kind: 'missing' },
    ]);
    expect(rows[0]?.scene).toBe(scenes[3]); expect(rows[4]?.scene).toBeNull();
  });
  it('지금은 추천 시기가 먼저 끝나는 곳부터이고 같은 끝 달은 이름순이다', () => {
    const scenes = [scene('late', 9, 11, '가을'), scene('b', 10, 10, '나무'), scene('a', 9, 10, '가을')];
    expect(savedOrder(scenes, ['late', 'b', 'a'], 10).map((row) => row.sceneId)).toEqual(['a', 'b', 'late']);
  });
  it('오늘 추천 시기 안이면 사진을 찍은 달이 달라도 지금이다', () => {
    const scenes = [scene('autumn', 10, 11)];
    expect(savedOrder(scenes, ['autumn'], 10)[0]?.status).toEqual({ kind: 'now', until: 11 });
  });
  it('언제나와 곧은 각각 이름순이고 저장하지 않은 곳은 나오지 않는다', () => {
    const scenes = [scene('all-b', 1, 12, '나무'), scene('all-a', 1, 12, '가을'), scene('soon-b', 11, 11, '나무'), scene('soon-a', 11, 11, '가을'), scene('unused', 10, 10)];
    expect(savedOrder(scenes, scenes.slice(0, 4).map((s) => s.id), 10).map((row) => row.sceneId)).toEqual(['all-a', 'all-b', 'soon-a', 'soon-b']);
  });
  it('해를 넘는 일 년 내내 기간도 언제나로 분류한다', () => {
    expect(savedOrder([scene('all', 3, 2)], ['all'], 10)[0]?.status).toEqual({ kind: 'always' });
  });
  it('그 밖은 시작 달이 가까운 순이고 같은 시작 달은 이름순이다', () => {
    const scenes = [scene('spring', 3, 4), scene('b', 12, 12, '나무'), scene('a', 12, 12, '가을')];
    expect(savedOrder(scenes, ['spring', 'b', 'a'], 10).map((row) => row.sceneId)).toEqual(['a', 'b', 'spring']);
  });
  it.each([
    [12, { kind: 'now', until: 2 }], [1, { kind: 'now', until: 2 }], [2, { kind: 'now', until: 2 }],
    [11, { kind: 'soon', from: 12 }], [3, { kind: 'later', from: 12 }],
  ])('%s월: 해를 넘는 12~2월 추천 시기를 맞게 분류한다', (month, status) => {
    expect(savedOrder([scene('winter', 12, 2)], ['winter'], month)[0]?.status).toEqual(status);
  });
  it('12월의 곧은 1월이고 겨울의 지금은 끝 달까지 남은 달로 정렬한다', () => {
    const scenes = [scene('jan', 1, 1), scene('feb', 11, 2), scene('dec', 12, 12)];
    expect(savedOrder(scenes, ['jan', 'feb', 'dec'], 12).map((row) => row.sceneId)).toEqual(['dec', 'feb', 'jan']);
    expect(savedOrder(scenes, ['jan'], 12)[0]?.status).toEqual({ kind: 'soon', from: 1 });
  });
  it('숨긴 장면·없는 장면·준비 중 장면은 맨 뒤에 저장한 순서대로 남긴다', () => {
    const hidden = { ...scene('hidden', 10, 10), hidden: true };
    const rows = savedOrder([hidden, placeholder('draft', '준비 중', '2020-10'), scene('visible', 10, 10)], ['hidden', 'missing', 'visible', 'draft'], 10);
    expect(rows.map((row) => row.sceneId)).toEqual(['visible', 'hidden', 'missing', 'draft']);
    for (const row of rows.slice(1)) { expect(row.scene).toBeNull(); expect(row.status).toEqual({ kind: 'missing' }); }
  });
  it('입력 배열을 바꾸지 않고 장면 객체와 추가 정보를 그대로 돌려준다', () => {
    const a = Object.freeze(scene('a', 10, 10, '가을')); const b = Object.freeze(scene('b', 10, 10, '나무'));
    const scenes = Object.freeze([b, a]); const wanted = Object.freeze(['b', 'a']);
    const rows = savedOrder(scenes, wanted, 10); rows.pop();
    expect(scenes).toEqual([b, a]); expect(wanted).toEqual(['b', 'a']);
    expect(savedOrder(scenes, wanted, 10)[0]?.scene).toBe(a);
  });
  it('저장한 곳이 없으면 빈 목록이다', () => { expect(savedOrder([], [], 10)).toEqual([]); });
});

describe('지금 좋은 저장 장소 알림 (F4-AC10)', () => {
  it('알림은 지금 장소만 목록과 같은 순서로 주고 언제나·곧·숨김은 뺀다', () => {
    const scenes = [scene('later-now', 10, 11), scene('earlier-now', 10, 10), scene('always', 1, 12), scene('soon', 11, 12), { ...scene('hidden', 10, 10), hidden: true }];
    const wanted = ['always', 'soon', 'later-now', 'hidden', 'missing', 'earlier-now'];
    expect(alertScenes(scenes, wanted, 10).map((s) => s.id)).toEqual(['earlier-now', 'later-now']);
    expect(alertScenes(scenes, wanted, 10)[0]).toBe(scenes[1]);
  });
  it('지금 좋은 곳이 없거나 저장이 없으면 알림도 없다', () => {
    const scenes = [scene('spring', 3, 4), scene('always', 1, 12)];
    expect(alertScenes(scenes, ['spring', 'always'], 10)).toEqual([]);
    expect(alertScenes(scenes, [], 10)).toEqual([]);
  });
  it('실제 앱 데이터의 모든 달에서도 장소를 빠뜨리지 않고 상태·알림·지금 순서가 맞다', () => {
    const scenes = ContentFile.parse(appData).scenes;
    const wanted = [...scenes.map((s) => s.id), 'deleted-scene'];
    expect(scenes.length).toBeGreaterThan(0);
    for (const month of MONTHS) {
      const rows = savedOrder(scenes, wanted, month);
      expect(new Set(rows.map((r) => r.sceneId))).toEqual(new Set(wanted));
      expect(rows).toHaveLength(wanted.length);
      const now = rows.filter((r) => r.status.kind === 'now');
      expect(alertScenes(scenes, wanted, month)).toEqual(now.map((r) => r.scene));
      const distance = (to: number) => (to - month + 12) % 12;
      for (let index = 1; index < now.length; index++) {
        expect(distance(now[index - 1]!.scene!.best!.to)).toBeLessThanOrEqual(distance(now[index]!.scene!.best!.to));
      }
      expect(rows.at(-1)?.status.kind).toBe('missing');
    }
  });
});
