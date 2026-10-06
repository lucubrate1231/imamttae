import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCENE_TYPES } from '../../src/domain/sceneTypes';

/** D44: 데이터의 풍경별 대표 사진(typeCovers)이 맞는지 — 그 장면이 그 풍경에 들어 있고, 사진 번호가 있고, 풍경끼리 겹치지 않음 */
const data = JSON.parse(readFileSync('public/data/scenes.json', 'utf8')) as {
  typeCovers?: Record<string, { scene: string; photo: number }>;
  scenes: { id: string; kind: string; types?: string[]; photos?: { src: string }[] }[];
};
const covers = Object.entries(data.typeCovers ?? {});
const ids = new Set(SCENE_TYPES.map((t) => t.id as string));

describe('typeCovers', () => {
  it.each(covers)('%s: 아는 풍경 · 그 장면이 그 풍경에 들어 있음 · 사진 번호가 있음', (type, c) => {
    expect(ids.has(type)).toBe(true);
    const s = data.scenes.find((x) => x.id === c.scene && x.kind === 'story');
    expect(s, `${c.scene}이 앱 데이터에 없음(숨겼거나 지움)`).toBeTruthy();
    expect(s!.types).toContain(type);
    expect(Number.isInteger(c.photo) && c.photo >= 1 && c.photo <= s!.photos!.length).toBe(true);
  });
  it('풍경끼리 같은 사진을 쓰지 않음', () => {
    const srcs = covers.map(([, c]) => data.scenes.find((x) => x.id === c.scene)?.photos?.[c.photo - 1]?.src);
    expect(new Set(srcs).size).toBe(srcs.length);
  });
});
