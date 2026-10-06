/**
 * 풍경 대표 사진 고르기 페이지(미리보기 /next/_review/covers/) 데이터 — D44(10/6, 사용자가 13가지 대표 사진을 직접 고름).
 * 풍경마다 그 풍경에 든 이야기 장면(숨긴 장면 빼고)의 사진을 모두. 사진 번호는 사람이 읽는 대로 1부터.
 */
import { SCENE_TYPES } from '../../src/domain/sceneTypes';

export type TypeCovers = Partial<Record<string, { scene: string; photo: number }>>;
type SceneLike = { id: string; kind: string; name: string; region: string; hidden?: boolean; types?: string[]; photos?: { src: string }[] };

export function coversPageData(scenes: readonly unknown[], chosen: TypeCovers = {}) {
  const stories = (scenes as SceneLike[]).filter((s) => s.kind === 'story' && !s.hidden);
  const types = SCENE_TYPES.map((t) => ({
    id: t.id,
    label: t.label,
    scenes: stories.filter((s) => s.types?.includes(t.id)).map((s) => ({ id: s.id, name: s.name, region: s.region, photos: (s.photos ?? []).map((p) => p.src) })),
  }));
  return { types, chosen };
}
