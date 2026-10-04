/**
 * 앱 데이터 만들기:  npx tsx pipeline/scenes/build.ts
 * content/scenes/drafts.json + content/brunch/index.json(글 제목) → public/data/scenes.json
 * 작가 확인용 메모는 public/_review/notes.json, 여쭐 법규 문장은 content/review/legal.json → public/_review/legal.json (앱은 읽지 않음)
 * 먼저 check-cli.ts 검사를 통과해야 합니다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildAppData, buildReviewNotes } from './appData';
import { sceneTier } from '../../src/domain/sceneTier';

const drafts = JSON.parse(readFileSync('content/scenes/drafts.json', 'utf8')) as { scenes: unknown[] };
const index = JSON.parse(readFileSync('content/brunch/index.json', 'utf8')) as { stories: { no: number; title: string }[] };
const titles = new Map(index.stories.map((s) => [s.no, s.title]));

const out = buildAppData(drafts.scenes, titles, new Date().toISOString());
mkdirSync('public/data', { recursive: true });
writeFileSync('public/data/scenes.json', JSON.stringify(out));
mkdirSync('public/_review', { recursive: true });
writeFileSync('public/_review/notes.json', JSON.stringify(buildReviewNotes(drafts.scenes)));
// 작가님께 여쭐 법규 문장(D20) — 장면 번호가 실제로 있는지만 확인하고 그대로 옮김
const legal = JSON.parse(readFileSync('content/review/legal.json', 'utf8')) as { posts: { brunchNo: number; scenes: string[] }[] };
const ids = new Set((drafts.scenes as { id: string }[]).map((s) => s.id));
for (const p of legal.posts) for (const id of p.scenes) if (!ids.has(id)) throw new Error(`content/review/legal.json: 없는 장면 ${id} (#${p.brunchNo})`);
writeFileSync('public/_review/legal.json', JSON.stringify(legal));
const peak = out.scenes.filter((s) => s.kind === 'story' && sceneTier(s) === 'peak').length;
console.log(`✓ public/data/scenes.json — ${out.scenes.length}곳 (제철 ${peak} · 기록 ${out.scenes.length - peak})`);
