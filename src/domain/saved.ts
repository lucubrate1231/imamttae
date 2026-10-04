import type { Scene, StoryScene } from '../../shared/schema/content';
import { inWindow, type Month } from './month';
import { isYearRound } from './sceneTier';

export type SavedStatus =
  | { kind: 'now'; until: Month }
  | { kind: 'always' }
  | { kind: 'soon'; from: Month }
  | { kind: 'later'; from: Month }
  | { kind: 'none' }
  | { kind: 'missing' };
export interface SavedRow { sceneId: string; scene: StoryScene | null; status: SavedStatus }

const monthsUntil = (today: Month, month: Month) => (month - today + 12) % 12;
function statusOf(scene: StoryScene, today: Month): SavedStatus {
  const best = scene.best;
  if (!best) return { kind: 'none' };
  if (isYearRound(best)) return { kind: 'always' };
  if (inWindow(today, best)) return { kind: 'now', until: best.to };
  if (monthsUntil(today, best.from) === 1) return { kind: 'soon', from: best.from };
  return { kind: 'later', from: best.from };
}
const rank: Record<SavedStatus['kind'], number> = { now: 0, always: 1, soon: 2, later: 3, none: 4, missing: 5 };

/** 저장한 장면을 오늘 가기 좋은 순서로 돌려준다. 입력 배열은 바꾸지 않는다. */
export function savedOrder(scenes: readonly Scene[], wantedIds: readonly string[], today: Month): SavedRow[] {
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const rows: SavedRow[] = wantedIds.map((sceneId) => {
    const scene = byId.get(sceneId);
    if (!scene || scene.kind !== 'story' || scene.hidden) {
      return { sceneId, scene: null, status: { kind: 'missing' } };
    }
    return { sceneId, scene, status: statusOf(scene, today) };
  });
  return rows.sort((a, b) => {
    const group = rank[a.status.kind] - rank[b.status.kind];
    if (group) return group;
    if (a.status.kind === 'missing') return 0;
    let distance = 0;
    if (a.status.kind === 'now' && b.status.kind === 'now') {
      distance = monthsUntil(today, a.status.until) - monthsUntil(today, b.status.until);
    } else if (a.status.kind === 'later' && b.status.kind === 'later') {
      distance = monthsUntil(today, a.status.from) - monthsUntil(today, b.status.from);
    }
    return distance || a.scene!.name.localeCompare(b.scene!.name, 'ko');
  });
}

/** 알림에는 추천 시기 안인 저장 장소만 같은 순서로 담는다. */
export function alertScenes(scenes: readonly Scene[], wantedIds: readonly string[], today: Month): StoryScene[] {
  return savedOrder(scenes, wantedIds, today)
    .filter((row) => row.status.kind === 'now').map((row) => row.scene!);
}
