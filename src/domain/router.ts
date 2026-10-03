/** 화면 주소(해시). 카카오톡으로 공유한 링크가 그 화면으로 바로 열리게 합니다. */
import { isSceneTypeId, type SceneTypeId } from './sceneTypes';
import { REGIONS, type RegionId } from './find';

export type Route =
  | { name: 'month'; month: number | null }
  | { name: 'find'; type: SceneTypeId | null; region: RegionId | null }
  | { name: 'scene'; id: string }
  | { name: 'stamps' };

const SCENE_ID = /^[a-z0-9-]{3,80}$/;

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map((p) => {
    try {
      return decodeURIComponent(p);
    } catch {
      return p;
    }
  });
  const [head, arg, regionArg] = parts;
  switch (head) {
    case 'month': {
      const m = Number(arg);
      return { name: 'month', month: Number.isInteger(m) && m >= 1 && m <= 12 ? m : null };
    }
    case 'find':
      return {
        name: 'find',
        type: arg && isSceneTypeId(arg) ? arg : null,
        region: REGIONS.find(({ id }) => id === regionArg)?.id ?? null,
      };
    case 'scene':
      if (arg && SCENE_ID.test(arg)) return { name: 'scene', id: arg };
      return { name: 'month', month: null };
    case 'stamps':
      return { name: 'stamps' };
    default:
      return { name: 'month', month: null };
  }
}

export function routeHref(r: Route): string {
  switch (r.name) {
    case 'month':
      return r.month ? `#/month/${r.month}` : '#/';
    case 'find':
      if (r.region) return `#/find/${r.type ?? 'all'}/${r.region}`;
      return r.type ? `#/find/${r.type}` : '#/find';
    case 'scene':
      return `#/scene/${r.id}`;
    case 'stamps':
      return '#/stamps';
  }
}
