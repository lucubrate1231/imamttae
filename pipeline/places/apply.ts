/**
 * 좌표 확인 페이지(serve.ts)에서 정한 값을 장면 초안에 넣기:
 *   npx tsx pipeline/places/apply.ts [결과 파일]   (기본 .cache/places/picked.json → content/scenes/drafts.json)
 *   결과 파일은 미리보기 좌표 확인 페이지의 [결과 복사]를 붙여 넣은 파일이어도 됨(예: tools/places/picked-seed.json)
 * 그다음 check-cli.ts(15km 등)와 build.ts로 앱 데이터를 다시 만듭니다.
 * 카카오 로컬 API 결과 저장 금지 — docs/kakao-local-data.md(사용자 결정 ③). 바꾼 장면은 coordSource가 kakao-search가 아니게 됩니다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readPicked } from './pageData';

type Source = 'public-data' | 'manual';
export interface PickedPoint { lat: number; lng: number; source: Source; ref: string | null }
export interface PickedDest extends PickedPoint { name: string; kind: 'parking' | 'trailhead' | 'entrance' }
export type Picked = Record<string, { spot?: PickedPoint; dest?: PickedDest }>;

type SceneLike = { id: string; coordSource?: string; [k: string]: unknown };

export type Applied<T> = T & { coordRef?: { spot: string; dest: string } };
export function applyPicked<T extends SceneLike>(scenes: readonly T[], picked: Picked): { scenes: Applied<T>[]; changed: string[]; remaining: string[] } {
  const changed: string[] = [];
  const out = scenes.map((s): Applied<T> => {
    const p = picked[s.id];
    if (!p?.spot || !p.dest || !p.dest.name.trim()) return s;
    changed.push(s.id);
    const ref = (pt: PickedPoint) => (pt.source === 'manual' ? 'manual' : (pt.ref ?? 'public-data'));
    return {
      ...s,
      spot: { lat: p.spot.lat, lng: p.spot.lng },
      dest: { name: p.dest.name.trim(), lat: p.dest.lat, lng: p.dest.lng, kind: p.dest.kind },
      coordSource: p.spot.source === 'public-data' && p.dest.source === 'public-data' ? 'public-data' : 'manual',
      coordRef: { spot: ref(p.spot), dest: ref(p.dest) },
    };
  });
  const remaining = out.filter((s) => s.coordSource === 'kakao-search').map((s) => s.id);
  return { scenes: out, changed, remaining };
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('pipeline/places/apply.ts')) {
  const path = 'content/scenes/drafts.json';
  const raw = readFileSync(path, 'utf8');
  const drafts = JSON.parse(raw) as { scenes: SceneLike[] };
  const picked = readPicked(readFileSync(process.argv[2] ?? '.cache/places/picked.json', 'utf8'));
  const r = applyPicked(drafts.scenes, picked);
  drafts.scenes = r.scenes;
  writeFileSync(path, JSON.stringify(drafts, null, 1) + (raw.endsWith('\n') ? '\n' : ''));
  console.log(`바꾼 장면 ${r.changed.length}곳 · 아직 카카오 좌표 ${r.remaining.length}곳`);
}
