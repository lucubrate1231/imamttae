/**
 * 앱 데이터 만들기:  npx tsx pipeline/scenes/build.ts
 * content/scenes/drafts.json + content/brunch/index.json(글 제목) → public/data/scenes.json
 * 작가 확인 메모·여쭐 법규 문장은 공개 저장소에 두지 않아요 — 비공개 저장소 lucubrate1231/imamttae-notes(공개 전 점검 6번).
 *   그 저장소가 옆 폴더(../imamttae-notes)에 있으면 법규 메모의 장면 번호가 실제로 있는지만 확인해요.
 * 먼저 check-cli.ts 검사를 통과해야 합니다.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildAppData } from './appData';
import { sceneTier } from '../../src/domain/sceneTier';

const drafts = JSON.parse(readFileSync('content/scenes/drafts.json', 'utf8')) as { scenes: unknown[] };
const index = JSON.parse(readFileSync('content/brunch/index.json', 'utf8')) as { stories: { no: number; title: string }[] };
const titles = new Map(index.stories.map((s) => [s.no, s.title]));

// 풍경별 대표 사진(D44): 사용자가 미리보기 '대표 사진 고르기'(/_review/covers/)에서 고른 결과. [결과 복사] 형식({ covers })도 그대로 받음
const coversPath = 'content/scenes/type-covers.json';
const coversRaw = existsSync(coversPath) ? (JSON.parse(readFileSync(coversPath, 'utf8')) as { covers?: Record<string, { scene: string; photo: number }> }) : {};
const typeCovers = (coversRaw.covers ?? coversRaw) as Record<string, { scene: string; photo: number }>;
const out = buildAppData(drafts.scenes, titles, new Date().toISOString(), typeCovers);
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/scenes.json', JSON.stringify(out));

// 비공개 법규 메모(D20)가 옆 폴더에 있으면 장면 번호만 확인(공개 쪽으로 옮기지 않음)
const legalPath = '../imamttae-notes/legal.json';
if (existsSync(legalPath)) {
  const legal = JSON.parse(readFileSync(legalPath, 'utf8')) as { posts: { brunchNo: number; scenes: string[] }[] };
  const ids = new Set((drafts.scenes as { id: string }[]).map((s) => s.id));
  for (const p of legal.posts) for (const id of p.scenes) if (!ids.has(id)) throw new Error(`imamttae-notes/legal.json: 없는 장면 ${id} (#${p.brunchNo})`);
}
const peak = out.scenes.filter((s) => s.kind === 'story' && sceneTier(s) === 'peak').length;
console.log(`✓ public/data/scenes.json — ${out.scenes.length}곳 (제철 ${peak} · 기록 ${out.scenes.length - peak})`);
