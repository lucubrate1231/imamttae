import { describe, expect, it } from 'vitest';
import { pickTypeCovers } from '../../src/domain/covers';
import type { StoryScene } from '../../shared/schema/content';

/** D44(10/6): 풍경 찾기 타일의 대표 사진 — 사용자가 고른 것 먼저, 고르지 않은 풍경은 지금 규칙대로 하되 겹치지 않게 */
const p = (n: number) => ({ src: `https://t1.kakaocdn.net/brunch/p${n}.jpg`, cap: '', w: 1200, h: 800 });
const scene = (id: string, types: string[], photos: number[]) => ({ id, types, photos: photos.map(p) }) as unknown as StoryScene;
const gaudo = scene('s-gaudo', ['bada', 'yeoreumkkot'], [1, 2, 3]);
const bidul = scene('s-bidul', ['unhae', 'gyegok'], [4, 5]);
const lotus = scene('s-lotus', ['yeoreumkkot'], [6]);
const stories = [gaudo, bidul, lotus];
const order = (t: string) => stories.filter((s) => (s.types as string[]).includes(t));
const src = (c: ReturnType<typeof pickTypeCovers>, t: string) => c.get(t as never)?.photo.src;

describe('pickTypeCovers', () => {
  it('고른 사진(번호는 1부터)을 그대로 씀 — 목록 맨 위 장면과 달라도', () => {
    const c = pickTypeCovers(['yeoreumkkot', 'bada'], stories, { yeoreumkkot: { scene: 's-lotus', photo: 1 }, bada: { scene: 's-gaudo', photo: 3 } }, order);
    expect(src(c, 'yeoreumkkot')).toBe(p(6).src);
    expect(src(c, 'bada')).toBe(p(3).src);
    expect(c.get('bada')!.scene.id).toBe('s-gaudo');
  });
  it('고르지 않은 풍경은 지금 규칙(목록 순서)대로 하되, 다른 타일이 쓴 사진은 건너뜀', () => {
    // 지금 규칙이면 운해·물안개 = 계곡·폭포 = 비둘기낭 첫 사진(p4)으로 겹침
    const c = pickTypeCovers(['unhae', 'gyegok'], stories, {}, order);
    expect(src(c, 'unhae')).toBe(p(4).src);
    expect(src(c, 'gyegok')).toBe(p(5).src); // 같은 장면 다음 사진
  });
  it('고른 사진이 먼저 자리를 잡고, 고르지 않은 풍경이 그 사진을 피함', () => {
    const c = pickTypeCovers(['bada', 'yeoreumkkot'], stories, { yeoreumkkot: { scene: 's-gaudo', photo: 1 } }, order);
    expect(src(c, 'yeoreumkkot')).toBe(p(1).src);
    expect(src(c, 'bada')).toBe(p(2).src);
  });
  it('고른 값이 틀리면(그 풍경에 없는 장면·없는 사진 번호·숨긴 장면) 무시하고 지금 규칙', () => {
    const c = pickTypeCovers(['bada', 'unhae'], stories, { bada: { scene: 's-lotus', photo: 1 }, unhae: { scene: 's-bidul', photo: 9 } }, order);
    expect(src(c, 'bada')).toBe(p(1).src);
    expect(src(c, 'unhae')).toBe(p(4).src);
  });
  it('쓸 사진이 없는 풍경은 빈칸(타일은 사진 없이)', () => {
    const c = pickTypeCovers(['sinrok'], stories, {}, order);
    expect(c.has('sinrok' as never)).toBe(false);
  });
});
