/**
 * 골든 마스터: TS로 옮긴 정리 코드가 예전 Python 결과(stories.json)와 같은지 확인합니다.
 * 브런치 글 전문이 필요해서 공개 저장소에는 넣지 않고, 작업 공간에 원본이 있을 때만 돌립니다.
 *   GOLDEN_DIR=/home/claude/natureapp npx vitest run tests/golden
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeArticle, normalizePhotoUrl, type ArticleInput } from '../../pipeline/brunch/normalize';

const dir = process.env.GOLDEN_DIR ?? '';
const ok = dir !== '' && existsSync(join(dir, 'stories.json'));

describe.skipIf(!ok)('골든 마스터: Python 결과와 같다', () => {
  const py = ok ? (JSON.parse(readFileSync(join(dir, 'stories.json'), 'utf8')) as Record<string, unknown>[]) : [];
  const fixHost = (v: unknown): unknown =>
    typeof v === 'string' && v.startsWith('http') ? normalizePhotoUrl(v) : Array.isArray(v) ? v.map(fixHost) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fixHost(x)])) : v;
  for (const p of py) {
    const no = p.brunch_no as number;
    it(`${no}번 글`, () => {
      const raw = JSON.parse(readFileSync(join(dir, 'brunch', `${String(no).padStart(2, '0')}.json`), 'utf8')) as ArticleInput;
      const s = normalizeArticle(raw);
      const want = fixHost(p) as Record<string, unknown>;
      expect(s.title).toBe(want.title);
      expect(s.subtitle).toBe(want.subtitle);
      expect(s.dateLine).toBe(want.date_line);
      expect(s.visit?.year ?? null).toBe(want.year);
      expect(s.visit?.month ?? null).toBe(want.month);
      expect(s.intro).toEqual(want.intro);
      expect(s.cover).toBe(want.cover);
      expect(s.photoCount).toBe(want.photo_count);
      expect(s.sections).toEqual(want.sections);
      expect(s.items).toEqual(want.items);
    });
  }
});
