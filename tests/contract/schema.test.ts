import { describe, expect, it } from 'vitest';
import { ContentFile, PlaceholderScene, StoryScene } from '../../shared/schema/content';
import sample from '../fixtures/scenes.sample.json';

describe('데이터 규칙(계약)', () => {
  it('표본 데이터가 규칙을 통과한다', () => {
    expect(() => ContentFile.parse(sample)).not.toThrow();
  });

  it('준비 중 장면에는 사진·본문을 넣을 수 없다(저장글 유출 방지)', () => {
    const leaked = { id: 'p-1-x', kind: 'placeholder', name: 'x', visited: '2023-11', spot: { lat: 35, lng: 129 }, photos: [] };
    expect(PlaceholderScene.safeParse(leaked).success).toBe(false);
  });

  it('브런치 사진 서버가 아닌 사진 주소는 거부', () => {
    const story = structuredClone(sample.scenes[0]) as Record<string, unknown>;
    story.photos = [{ src: 'https://example.com/a.jpg', cap: '', w: 1, h: 1 }];
    expect(StoryScene.safeParse(story).success).toBe(false);
  });

  it('위도·경도가 뒤바뀐 좌표는 거부', () => {
    const story = structuredClone(sample.scenes[0]) as Record<string, unknown>;
    story.dest = { name: 'x', lat: 128.45, lng: 38.07, kind: 'parking' };
    expect(StoryScene.safeParse(story).success).toBe(false);
  });

  it('가장 좋은 때가 없는 장면(기록)도 통과', () => {
    const story = structuredClone(sample.scenes[0]) as Record<string, unknown>;
    delete story.best;
    expect(StoryScene.safeParse(story).success).toBe(true);
  });

  it('가장 좋은 때를 적었다면 시작·끝 달이 있어야 함', () => {
    const story = structuredClone(sample.scenes[0]) as Record<string, unknown>;
    story.best = { note: '여름' };
    expect(StoryScene.safeParse(story).success).toBe(false);
  });

  it('가장 좋은 때의 계절말(늦가을, 초여름 등)은 짧게(8자 안)', () => {
    const story = structuredClone(sample.scenes[0]) as Record<string, unknown>;
    story.best = { from: 10, to: 11, note: '10월 하순~11월 초', season: '늦가을' };
    expect(StoryScene.safeParse(story).success).toBe(true);
    story.best = { from: 10, to: 11, note: '', season: '가을이 깊어 가는 무렵' };
    expect(StoryScene.safeParse(story).success).toBe(false);
  });

  it('새 명장면 종류(계곡·폭포, 바다 절경, 신록·초원)를 받음', () => {
    const story = structuredClone(sample.scenes[0]) as Record<string, unknown>;
    story.types = ['gyegok', 'bada', 'sinrok'];
    expect(StoryScene.safeParse(story).success).toBe(true);
  });

  it('없는 명장면 종류는 거부', () => {
    const story = structuredClone(sample.scenes[0]) as Record<string, unknown>;
    story.types = ['차박'];
    expect(StoryScene.safeParse(story).success).toBe(false);
  });
});
