import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { monthRangeIssues } from '../../pipeline/scenes/check';

// D68(10/8): 숨긴 장면·초안까지 모든 장면의 추천 시기는 'N월~N월' 표기(같은 달은 'N월', '일 년 내내'는 그대로)
describe('장면 초안의 추천 시기 표기(D68)', () => {
  const drafts = JSON.parse(readFileSync('content/scenes/drafts.json', 'utf8')) as {
    scenes: { id: string; best?: { note?: string; tip?: string } }[];
  };
  it("'N~N월' 꼴이 하나도 없다", () => {
    const bad = drafts.scenes.flatMap((s) => monthRangeIssues(s.best).map((m) => `${s.id}: ${m}`));
    expect(bad).toEqual([]);
  });
});
