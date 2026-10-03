/**
 * 장면 초안 파일 검사:  npx tsx pipeline/scenes/check-cli.ts content/scenes/drafts.json [다른 파일…]
 * 글 원문은 .cache/brunch/NN.json 에서 읽습니다(먼저 npx tsx pipeline/sync.ts).
 */
import { readFileSync, existsSync } from 'node:fs';
import { checkScene } from './check';
import type { Story } from '../brunch/normalize';
import { sceneTier, type TierInput } from '../../src/domain/sceneTier';

const files = process.argv.slice(2);
let bad = 0;
let total = 0;
const tiers = { peak: 0, record: 0 };
const ids = new Set<string>();
for (const f of files) {
  const data = JSON.parse(readFileSync(f, 'utf8')) as { scenes?: unknown[] } | unknown[];
  const scenes = (Array.isArray(data) ? data : (data.scenes ?? [])) as { id?: string; brunchNo?: number }[];
  for (const sc of scenes) {
    total++;
    const id = sc.id ?? '(id 없음)';
    const probs: string[] = [];
    if (ids.has(id)) probs.push('id 중복');
    ids.add(id);
    const cache = `.cache/brunch/${String(sc.brunchNo).padStart(2, '0')}.json`;
    if (!existsSync(cache)) probs.push(`원문 캐시 없음: ${cache}`);
    else probs.push(...checkScene(sc, JSON.parse(readFileSync(cache, 'utf8')) as Story));
    try {
      tiers[sceneTier(sc as unknown as TierInput)]++;
    } catch {
      /* 형식 오류는 위 검사가 알려 줌 */
    }
    if (probs.length) {
      bad++;
      console.log(`✗ ${id}`);
      for (const p of probs) console.log(`   - ${p}`);
    }
  }
}
console.log(bad ? `✗ ${total}곳 중 ${bad}곳 문제` : `✓ ${total}곳 모두 통과`);
console.log(`  제철 ${tiers.peak}곳 · 기록 ${tiers.record}곳`);
process.exitCode = bad ? 1 : 0;
