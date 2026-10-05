import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 공개하지 않는 메모는 공개 저장소에 두지 않음(공개 전 점검 6번, 사용자 결정 10/5)
 * 법규 메모·장면 내부 메모는 비공개 저장소 lucubrate1231/imamttae-notes 에 있어요(docs/public-repo-check.md)
 */
const root = resolve(__dirname, '../..');
describe('공개 저장소에 비공개 메모가 없음', () => {
  it.each(['content/review/legal.json', 'public/_review/legal.json', 'public/_review/notes.json'])('%s 없음', (p) => {
    expect(existsSync(resolve(root, p))).toBe(false);
  });

  it('장면 초안(content/scenes/drafts.json)에 notes 칸이 없음 — 메모는 비공개 저장소 scene-notes.json에', () => {
    const drafts = JSON.parse(readFileSync(resolve(root, 'content/scenes/drafts.json'), 'utf8')) as { scenes: Record<string, unknown>[] };
    expect(drafts.scenes.filter((s) => 'notes' in s).map((s) => s.id)).toEqual([]);
  });
});
