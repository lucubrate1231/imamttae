import { describe, expect, it } from 'vitest';
import { coversPageData } from '../../pipeline/covers/pageData';

/** D44(10/6): 풍경 13가지 대표 사진을 사용자가 고르는 페이지(미리보기 /next/_review/covers/)의 데이터 */
const photo = (n: number) => ({ src: `https://t1.kakaocdn.net/brunch/p${n}.jpg`, cap: '', w: 1200, h: 800 });
const scenes = [
  { id: 's-1', kind: 'story', name: '가우도', region: '전남 강진', types: ['bada', 'yeoreumkkot'], photos: [photo(1), photo(2)] },
  { id: 's-2', kind: 'story', name: '숨김', region: '어딘가', types: ['bada'], hidden: true, photos: [photo(3)] },
  { id: 'p-3', kind: 'placeholder', name: '준비 중', region: '어딘가' },
];

describe('coversPageData', () => {
  const d = coversPageData(scenes, { bada: { scene: 's-1', photo: 2 } });
  it('풍경 13가지 순서대로, 이름과 함께', () => {
    expect(d.types).toHaveLength(13);
    expect(d.types[0]!.id).toBe('maehwa');
    expect(d.types.find((t) => t.id === 'bada')!.label).toBeTruthy();
  });
  it('그 풍경에 든 이야기 장면의 사진 모두(숨긴 장면·준비 중 빼고), 사진 번호는 1부터', () => {
    const bada = d.types.find((t) => t.id === 'bada')!;
    expect(bada.scenes).toEqual([{ id: 's-1', name: '가우도', region: '전남 강진', photos: [photo(1).src, photo(2).src] }]);
    expect(d.types.find((t) => t.id === 'yeoreumkkot')!.scenes.map((s) => s.id)).toEqual(['s-1']);
  });
  it('지금 고른 값(있으면)을 함께', () => {
    expect(d.chosen).toEqual({ bada: { scene: 's-1', photo: 2 } });
  });
});
