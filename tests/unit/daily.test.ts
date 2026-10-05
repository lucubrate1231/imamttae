import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true }); });
const story = (no: number, extra = {}) => ({ no, title: `글 ${no}`, url: `https://brunch.co.kr/@writer/${no}`, contentHash: `hash-${no}`, ...extra });
const index = (stories = [story(1)], generatedAt = 'before') => ({ version: 1, generatedAt, count: stories.length, stories });
function fixture(before = index()) {
  const root = mkdtempSync(join(tmpdir(), 'imamttae-daily-')); roots.push(root);
  mkdirSync(join(root, 'content/brunch'), { recursive: true });
  mkdirSync(join(root, 'public/data'), { recursive: true });
  const indexPath = join(root, 'content/brunch/index.json');
  const scenesPath = join(root, 'public/data/scenes.json');
  const beforeText = JSON.stringify(before, null, 1) + '\n';
  writeFileSync(indexPath, beforeText);
  writeFileSync(scenesPath, '{"generatedAt":"before","scenes":[]}');
  return { root, indexPath, scenesPath, beforeText };
}
const now = new Date('2026-10-05T21:00:00Z');
const runUrl = 'https://github.com/lucubrate1231/imamttae/actions/runs/123';

describe('매일 동기화: 글 내용이 바뀐 경우에만 검사와 PR 준비', () => {
  it('생성 시각·글 순서·객체 속성 순서만 달라지면 변경이 아니다', async () => {
    const { compareIndexes } = await import('../../pipeline/daily');
    const before = index([story(1), story(2)]);
    const after = index([story(2), { contentHash: 'hash-1', url: 'https://brunch.co.kr/@writer/1', title: '글 1', no: 1 }], 'after');
    expect(compareIndexes(before, after).changed).toBe(false);
  });
  it('새 글과 바뀐 글을 번호순으로 나눈다', async () => {
    const { compareIndexes } = await import('../../pipeline/daily');
    const result = compareIndexes(index([story(1), story(2)]), index([story(3), story(2, { contentHash: 'new' }), story(1)]));
    expect(result.added.map(s => s.no)).toEqual([3]);
    expect(result.updated.map(s => s.no)).toEqual([2]);
    expect(result.changed).toBe(true);
  });
  it('해시가 같아도 제목·사진 정보가 바뀌면 변경이다', async () => {
    const { compareIndexes } = await import('../../pipeline/daily');
    expect(compareIndexes(index(), index([story(1, { title: '바뀐 제목', photos: [{ cap: '사진' }] })])).updated.map(s => s.no)).toEqual([1]);
  });
  it('빠진 글도 숨기지 않고 설명에 남긴다', async () => {
    const { compareIndexes, formatDailySummary } = await import('../../pipeline/daily');
    const diff = compareIndexes(index([story(1), story(2)]), index());
    expect(diff.removed.map(s => s.no)).toEqual([2]);
    expect(formatDailySummary(diff, now, runUrl).body).toContain('목록에서 빠진 글');
  });
  it.each(['duplicate', 'count', 'url'])('깨진 목록은 PR 전에 거절한다: %s', async kind => {
    const { compareIndexes } = await import('../../pipeline/daily');
    const bad = kind === 'duplicate' ? index([story(1), story(1)]) : kind === 'count' ? { ...index(), count: 9 } : index([story(1, { url: 'javascript:alert(1)' })]);
    expect(() => compareIndexes(index(), bad)).toThrow(/글 목록/);
  });
  it('PR 제목 날짜는 한국 시간이며 외부 제목은 한 줄의 안전한 링크 글자로 만든다', async () => {
    const { compareIndexes, formatDailySummary } = await import('../../pipeline/daily');
    const diff = compareIndexes(index([]), index([story(1, { title: '[글]\n**제목**' })]));
    const result = formatDailySummary(diff, now, runUrl);
    expect(result.title).toBe('브런치 새 글 1편 (2026-10-06)');
    expect(result.body).toContain('\\[글\\] \\*\\*제목\\*\\*');
    expect(result.body).toContain('검사는 동기화 워크플로에서 통과');
    expect(result.body).toContain(runUrl);
  });
  it('내용이 같으면 원래 파일을 그대로 복원하고 검사·PR 준비 없이 끝난다', async () => {
    const { runDaily } = await import('../../pipeline/daily');
    const f = fixture(); const calls: string[] = [];
    const result = runDaily({ root: f.root, now, runUrl, runCommand: (command, args) => {
      calls.push([command, ...args].join(' ')); writeFileSync(f.indexPath, JSON.stringify(index([story(1)], 'after')));
    } });
    expect(calls).toEqual(['npx tsx pipeline/sync.ts']);
    expect(result.changed).toBe(false);
    expect(readFileSync(f.indexPath, 'utf8')).toBe(f.beforeText);
  });
  it('하나 지운 목록은 동기화로 복원하고 세 검사를 순서대로 통과한 뒤 PR을 준비한다', async () => {
    const { runDaily } = await import('../../pipeline/daily');
    const f = fixture(index([])); const calls: string[] = [];
    const result = runDaily({ root: f.root, now, runUrl, runCommand: (command, args) => {
      calls.push([command, ...args].join(' '));
      if (args.includes('pipeline/sync.ts')) writeFileSync(f.indexPath, JSON.stringify(index()));
    } });
    expect(calls).toEqual(['npx tsx pipeline/sync.ts', 'npx tsx pipeline/scenes/check-cli.ts content/scenes/drafts.json', 'npx tsx pipeline/scenes/build.ts', 'npm run check']);
    expect(result.changed).toBe(true);
    if (!result.changed) throw new Error('복원한 새 글이 있어야 합니다.');
    expect(result.title).toBe('브런치 새 글 1편 (2026-10-06)');
    expect(result.body).toContain('1번');
  });
  it.each(['pipeline/sync.ts', 'pipeline/scenes/check-cli.ts', 'pipeline/scenes/build.ts', 'check'])('명령 실패는 PR 준비까지 진행하지 않는다: %s', async failure => {
    const { runDaily } = await import('../../pipeline/daily');
    const f = fixture(index([])); const calls: string[] = [];
    expect(() => runDaily({ root: f.root, now, runUrl, runCommand: (_command, args) => {
      calls.push(args.join(' '));
      if (args.includes(failure)) throw new Error(`실패: ${failure}`);
      if (args.includes('pipeline/sync.ts')) writeFileSync(f.indexPath, JSON.stringify(index()));
    } })).toThrow(`실패: ${failure}`);
    expect(calls.at(-1)).toContain(failure);
  });
  it('앱 데이터의 생성 시각만 바뀐 것은 커밋 대상에서 없앤다', async () => {
    const { runDaily } = await import('../../pipeline/daily');
    const f = fixture(index([])); const original = readFileSync(f.scenesPath, 'utf8');
    runDaily({ root: f.root, now, runUrl, runCommand: (_command, args) => {
      if (args.includes('pipeline/sync.ts')) writeFileSync(f.indexPath, JSON.stringify(index()));
      if (args.includes('pipeline/scenes/build.ts')) writeFileSync(f.scenesPath, '{"scenes":[],"generatedAt":"after"}');
    } });
    expect(readFileSync(f.scenesPath, 'utf8')).toBe(original);
  });
  it('워크플로는 매일 6시와 수동 실행이며 성공한 준비 뒤에만 두 데이터 파일을 올린다', () => {
    const source = readFileSync('.github/workflows/sync.yml', 'utf8');
    expect(source).toContain("cron: '0 21 * * *'");
    expect(source).toContain('workflow_dispatch:');
    expect(source).toContain('npm ci');
    expect(source).toContain('actions/cache@');
    expect(source).toContain('.cache/brunch');
    expect(source).toContain("if: steps.daily.outputs.changed == 'true'");
    expect(source).toContain('git add -- content/brunch/index.json public/data/scenes.json');
    expect(source).not.toMatch(/git add (?:\.|-A|--all)|KAKAO|continue-on-error|if: always/);
    expect(source).toContain('bot/brunch-sync');
    expect(source).not.toMatch(/git push[^\n]*\bmain\b/);
  });
});
