/** 매일 동기화의 변경 판단과 검사. 글 전문은 PR 설명에 넣지 않습니다. */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

type Entry = Record<string, unknown> & { no: number; title: string; url: string; contentHash: string };
type Index = Record<string, unknown> & { stories: Entry[] };
export interface IndexDiff { changed: boolean; added: Entry[]; updated: Entry[]; removed: Entry[] }
type RunCommand = (command: string, args: string[]) => void;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validateIndex(value: unknown): Index {
  const fail = (): never => { throw new Error('글 목록 형식이 잘못되었습니다. 동기화 기록을 확인하세요.'); };
  if (!value || typeof value !== 'object') return fail();
  const index = value as Record<string, unknown>;
  if (index.version !== 1 || !Array.isArray(index.stories) || index.count !== index.stories.length) return fail();
  const numbers = new Set<number>();
  for (const entry of index.stories as Record<string, unknown>[]) {
    if (!entry || !Number.isSafeInteger(entry.no) || Number(entry.no) < 1 || numbers.has(Number(entry.no)) ||
      typeof entry.title !== 'string' || !entry.title.trim() || typeof entry.contentHash !== 'string' || typeof entry.url !== 'string') return fail();
    let url: URL;
    try { url = new URL(entry.url); } catch { return fail(); }
    if (url.protocol !== 'https:' || url.hostname !== 'brunch.co.kr' || url.username || url.password) return fail();
    numbers.add(Number(entry.no));
  }
  return index as Index;
}

function withoutTime(value: Record<string, unknown>) {
  const { generatedAt: _time, ...rest } = value;
  return rest;
}

export function compareIndexes(beforeValue: unknown, afterValue: unknown): IndexDiff {
  const before = validateIndex(beforeValue); const after = validateIndex(afterValue);
  const old = new Map(before.stories.map(entry => [entry.no, entry]));
  const current = new Map(after.stories.map(entry => [entry.no, entry]));
  const sorted = (entries: Entry[]) => entries.sort((a, b) => a.no - b.no);
  const normalize = (index: Index) => ({ ...withoutTime(index), stories: sorted([...index.stories]) });
  return {
    changed: canonical(normalize(before)) !== canonical(normalize(after)),
    added: sorted(after.stories.filter(entry => !old.has(entry.no))),
    updated: sorted(after.stories.filter(entry => old.has(entry.no) && canonical(old.get(entry.no)) !== canonical(entry))),
    removed: sorted(before.stories.filter(entry => !current.has(entry.no))),
  };
}

export function formatDailySummary(diff: IndexDiff, now: Date, runUrl: string) {
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const text = (value: string) => value.replace(/\s+/g, ' ').replace(/[\\[\]()*_`<>]/g, '\\$&');
  const list = (entries: Entry[]) => entries.length ? entries.map(entry => {
    const url = entry.url.replace(/[<>\s()]/g, char => encodeURIComponent(char));
    return `- ${entry.no}번 · [${text(entry.title)}](${url})`;
  }).join('\n') : '- 없음';
  return {
    title: `브런치 새 글 ${diff.added.length}편 (${date})`,
    body: `## ① 무엇을 왜\n브런치의 발행된 글 목록을 최신으로 받았습니다. 장면 초안과 작가 글 대목은 고치지 않았습니다.\n\n### 새 글\n${list(diff.added)}\n\n### 바뀐 글\n${list(diff.updated)}\n\n### 목록에서 빠진 글\n${list(diff.removed)}\n\n## ② 해당 완성 기준\n일 6: 동기화 → 원문 대조 → 앱 데이터 만들기 → 전체 검사를 모두 통과한 경우에만 올립니다.\n검사는 동기화 워크플로에서 통과([실행 기록](${runUrl})). 기본 토큰으로 만든 PR에는 별도 ci가 자동 실행되지 않습니다.\n\n## ③ 내가 확인할 곳\n위 글 주소와 글 목록의 변경을 확인해 주세요. 콘텐츠 세션에 새 글의 장면 초안을 부탁한 뒤 합쳐 주세요. 글 전문과 캐시는 커밋하지 않았습니다.\n`,
  };
}

export function runDaily(options: { root?: string; now?: Date; runUrl?: string; runCommand?: RunCommand } = {}) {
  const root = options.root ?? process.cwd();
  const run: RunCommand = options.runCommand ?? ((command, args) => {
    const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`동기화 명령 실패: ${command} ${args.join(' ')} (${result.status ?? result.signal})`);
  });
  const indexPath = join(root, 'content/brunch/index.json');
  const scenesPath = join(root, 'public/data/scenes.json');
  const beforeIndex = readFileSync(indexPath, 'utf8');
  const beforeScenes = readFileSync(scenesPath, 'utf8');
  run('npx', ['tsx', 'pipeline/sync.ts']);
  const diff = compareIndexes(JSON.parse(beforeIndex), JSON.parse(readFileSync(indexPath, 'utf8')));
  if (!diff.changed) {
    writeFileSync(indexPath, beforeIndex);
    return { changed: false as const };
  }
  run('npx', ['tsx', 'pipeline/scenes/check-cli.ts', 'content/scenes/drafts.json']);
  run('npx', ['tsx', 'pipeline/scenes/build.ts']);
  const afterScenes = readFileSync(scenesPath, 'utf8');
  if (canonical(withoutTime(JSON.parse(beforeScenes))) === canonical(withoutTime(JSON.parse(afterScenes)))) writeFileSync(scenesPath, beforeScenes);
  run('npm', ['run', 'check']);
  return { changed: true as const, ...formatDailySummary(diff, options.now ?? new Date(), options.runUrl ?? 'https://github.com/lucubrate1231/imamttae/actions') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = runDaily({ runUrl: process.env.SYNC_RUN_URL });
    if (result.changed) {
      const bodyFile = join(process.env.RUNNER_TEMP ?? process.cwd(), 'brunch-sync-body.md');
      writeFileSync(bodyFile, result.body);
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=true\ntitle=${result.title}\nbody_file=${bodyFile}\n`);
      console.log(result.title);
    } else {
      if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'changed=false\n');
      console.log('글 목록 변경 없음.');
    }
  } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
}
