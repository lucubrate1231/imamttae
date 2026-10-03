import { describe, expect, it } from 'vitest';
import { ContentFile } from '../../shared/schema/content';
import appData from '../../public/data/scenes.json';
import drafts from '../../content/scenes/drafts.json';

/** 앱이 읽는 데이터(public/data/scenes.json)가 규칙에 맞고, 장면 초안과 어긋나지 않는지 */
describe('앱 데이터(계약)', () => {
  it('데이터 규칙을 통과', () => {
    expect(() => ContentFile.parse(appData)).not.toThrow();
  });
  it('장면 초안과 같은 장면들(숨긴 것 빼고) — 다르면 npx tsx pipeline/scenes/build.ts 를 다시 돌리세요', () => {
    type Lite = { id: string; hidden?: boolean; types: string[]; visited: string; best?: unknown; oneLiner: string };
    const pick = (s: Lite) => JSON.stringify([s.id, s.types, s.visited, s.best ?? null, s.oneLiner]);
    const want = (drafts.scenes as Lite[]).filter((s) => !s.hidden).map(pick);
    expect((appData.scenes as Lite[]).map(pick)).toEqual(want);
  });
  it('작가 확인 메모(notes)는 앱 데이터에 없음', () => {
    expect(appData.scenes.some((s) => 'notes' in s)).toBe(false);
  });
});
