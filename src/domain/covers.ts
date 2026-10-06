/**
 * 풍경 찾기 타일의 대표 사진(D44, 10/6 — 사용자가 13가지를 직접 고름)
 * - 고른 사진(데이터 typeCovers, 사진 번호는 1부터)을 먼저. 목록 맨 위 장면과 달라도 됨(타일은 그 풍경을 대표하는 그림).
 * - 고르지 않은 풍경(새 풍경 등)은 지금 규칙(목록 순서 — 지금 좋은 곳 → 일 년 내내 → 곧)대로 하되,
 *   다른 타일이 이미 쓴 사진은 건너뜀(같은 장면이 여러 풍경에 들어 겹치던 것: 운해·물안개 = 계곡·폭포).
 * - 고른 값이 틀리면(그 풍경에 없는 장면·없는 사진 번호·숨긴 장면) 무시. 데이터 검사는 tests/contract/typeCovers.test.ts.
 * - 화면에서 쓰는 계산이라 화면 작업과 함께 Claude Code가 만듦(Codex 파일 아님).
 */
import type { StoryScene } from '../../shared/schema/content';
import type { SceneTypeId } from './sceneTypes';

export interface TypeCover {
  scene: string;
  /** 그 장면의 몇 번째 사진(1부터) */
  photo: number;
}
export type TypeCovers = Partial<Record<SceneTypeId, TypeCover>>;
type Photo = StoryScene['photos'][number];

export function pickTypeCovers(
  types: readonly SceneTypeId[],
  stories: readonly StoryScene[],
  chosen: TypeCovers,
  order: (t: SceneTypeId) => readonly StoryScene[],
): Map<SceneTypeId, { scene: StoryScene; photo: Photo }> {
  const out = new Map<SceneTypeId, { scene: StoryScene; photo: Photo }>();
  const used = new Set<string>(); // 사진 주소(같은 사진이 두 장면에 들어도 겹침으로 봄)
  for (const t of types) {
    const c = chosen[t];
    const s = c && stories.find((x) => x.id === c.scene && x.types.includes(t));
    const photo = s?.photos[c!.photo - 1];
    if (!s || !photo || used.has(photo.src)) continue;
    out.set(t, { scene: s, photo });
    used.add(photo.src);
  }
  for (const t of types) {
    if (out.has(t)) continue;
    pick: for (const s of order(t))
      for (const photo of s.photos)
        if (!used.has(photo.src)) {
          out.set(t, { scene: s, photo });
          used.add(photo.src);
          break pick;
        }
  }
  return out;
}
