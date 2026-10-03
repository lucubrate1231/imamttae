import { describe, expect, it } from 'vitest';
import { buildAppData, buildReviewNotes, tripLabel } from '../../pipeline/scenes/appData';
import { ContentFile } from '../../shared/schema/content';
import sample from '../fixtures/scenes.sample.json';

const story = structuredClone(sample.scenes[0]) as Record<string, unknown>;

describe('tripLabel: 글 제목에서 "몇 번째 여행" 꺼내기', () => {
  it('보통 제목', () => {
    expect(tripLabel('스무 번째 여행 - 내장산과 담양')).toBe('스무 번째 여행');
    expect(tripLabel('두 번째 여행- 경상북도 수목원')).toBe('두 번째 여행');
  });
  it('형식이 다르면 없음', () => {
    expect(tripLabel('60대 부부, 살아서 가볼 100번의 여행을 약속하다')).toBeUndefined();
  });
});

describe('buildAppData: 장면 초안 → 앱 데이터', () => {
  const titles = new Map([[Number(story.brunchNo), '스무 번째 여행 - 내장산과 담양']]);
  const drafts = [
    { ...story, id: 's-a', notes: '작가께 확인할 것' },
    { ...story, id: 's-hidden', hidden: true },
  ];
  const out = buildAppData(drafts, titles, '2026-10-03T00:00:00Z');

  it('앱 데이터 규칙을 통과', () => {
    expect(() => ContentFile.parse(out)).not.toThrow();
  });
  it('숨긴 장면은 빼고, 작가 확인 메모(notes)는 앱에 싣지 않음', () => {
    expect(out.scenes.map((s) => s.id)).toEqual(['s-a']);
    expect(JSON.stringify(out)).not.toContain('작가께 확인할 것');
  });
  it('몇 번째 여행인지 붙임', () => {
    const s = out.scenes[0]!;
    expect(s.kind === 'story' && s.trip).toBe('스무 번째 여행');
  });
  it('규칙에 어긋난 초안이 있으면 만들지 않음(잘못된 데이터가 화면에 나가지 않게)', () => {
    expect(() => buildAppData([{ ...story, id: 'BAD ID' }], titles, '2026-10-03T00:00:00Z')).toThrow();
  });
});

describe('buildReviewNotes: 작가 확인용 메모는 따로', () => {
  it('숨긴 장면 빼고 id → 메모', () => {
    const out = buildReviewNotes([
      { ...story, id: 's-a', notes: '주차장 확인' },
      { ...story, id: 's-b' },
      { ...story, id: 's-c', notes: 'x', hidden: true },
    ]);
    expect(out).toEqual({ 's-a': '주차장 확인' });
  });
});
