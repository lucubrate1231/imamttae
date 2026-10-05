/**
 * 좌표 확인 페이지를 미리보기 사이트(/next/_review/places/)에 올릴 때 쓰는 데이터(10/5 사용자 — 콘텐츠 세션에서 이어서 하려고).
 * - 공개 사이트라 카카오에서 찾은 지금 좌표(spot·dest)와 작가 내부 메모는 넣지 않음(카카오 로컬 API 결과 저장 금지, 공개 전 점검 6번)
 * - 후보: tools/places/candidates.json(한국관광공사 관광정보·전국주차장정보표준데이터 — 공공데이터)
 * - seed: tools/places/picked-seed.json(지금까지 사람이 확인한 값). 새로 확인한 값은 그 브라우저에 저장되고 [결과 복사]로 넘김
 */
import type { Picked } from './apply';

type Draft = { id: string; kind: string; name: string; region: string; brunchUrl?: string; hidden?: boolean; types?: string[]; photos?: { src: string }[] };
export interface PageScene { id: string; name: string; region: string; brunchUrl?: string; types?: string[]; photo: string | null }

export function placesPageData(drafts: readonly unknown[], candidates: readonly unknown[], seed: Picked): { scenes: PageScene[]; candidates: readonly unknown[]; seed: Picked } {
  const scenes = (drafts as Draft[])
    .filter((s) => s.kind === 'story' && !s.hidden)
    .map((s) => ({ id: s.id, name: s.name, region: s.region, brunchUrl: s.brunchUrl, types: s.types, photo: s.photos?.[0]?.src ?? null }));
  return { scenes, candidates, seed };
}

/** 확인 결과 읽기: 페이지의 [결과 복사] 형식({ format, picked })과 예전 picked.json(장면 번호가 바로 열쇠) 둘 다 */
export function readPicked(text: string): Picked {
  const v = JSON.parse(text) as { format?: string; picked?: Picked } & Picked;
  return typeof v.format === 'string' && v.picked ? v.picked : (v as Picked);
}
