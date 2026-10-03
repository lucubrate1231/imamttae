/**
 * 브런치 동기화: 발행된 글을 모두 확인하고, 바뀐 글만 다시 받아 정리합니다.
 *   npx tsx pipeline/sync.ts
 * - 글 전문(정리본)은 .cache/brunch/NN.json 에만 둡니다(공개 저장소에 올리지 않음: 작가 글 보호, 공모전 중복 게재 우려).
 * - 저장소에는 content/brunch/index.json(글 목록·날짜·소제목·사진 주소)만 남깁니다.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { listPublished, fetchArticle } from './brunch/api';
import { normalizeArticle, type Story } from './brunch/normalize';
import { parseVisitDate } from '../src/domain/dateLine';

const CACHE = '.cache/brunch';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, '0');

export interface IndexEntry {
  no: number;
  title: string;
  url: string;
  publishTime: number | null;
  contentHash: string;
  dateLine: string | null;
  visit: Story['visit'];
  sections: string[];
  photos: { src: string; w: number; h: number; cap: string; section: string | null }[];
}

export function toIndexEntry(s: Story): IndexEntry {
  const photos: IndexEntry['photos'] = [];
  let section: string | null = null;
  for (const it of s.items) {
    if (it.t === 'h2') section = it.text;
    else if (it.t === 'img') photos.push({ src: it.src, w: it.w, h: it.h, cap: it.cap, section });
    else if (it.t === 'gallery') for (const g of it.imgs) photos.push({ ...g, section });
  }
  return { no: s.brunchNo, title: s.title, url: s.url, publishTime: s.publishTime, contentHash: s.contentHash, dateLine: s.dateLine, visit: s.dateLine ? parseVisitDate(s.dateLine) : null, sections: s.sections, photos };
}

async function main(): Promise<void> {
  mkdirSync(CACHE, { recursive: true });
  mkdirSync('content/brunch', { recursive: true });
  const list = await listPublished();
  const stories: Story[] = [];
  const changed: number[] = [];
  const failed: number[] = [];
  for (const item of list) {
    const file = `${CACHE}/${pad(item.no)}.json`;
    if (existsSync(file)) {
      const cached = JSON.parse(readFileSync(file, 'utf8')) as Story;
      if (cached.contentHash === item.contentHash) {
        stories.push(cached);
        continue;
      }
    }
    try {
      const a = await fetchArticle(item.no);
      if (!a) throw new Error('글 데이터를 찾지 못함(페이지 구조 변경?)');
      const s = normalizeArticle(a);
      writeFileSync(file, JSON.stringify(s, null, 1));
      stories.push(s);
      changed.push(item.no);
    } catch (e) {
      failed.push(item.no);
      console.error(`✗ ${item.no}번 글: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(400);
  }
  const index = { version: 1, generatedAt: new Date().toISOString(), count: stories.length, stories: stories.map(toIndexEntry) };
  writeFileSync('content/brunch/index.json', JSON.stringify(index, null, 1) + '\n');
  console.log(`✓ 발행 ${list.length}편 / 새로 받음 ${changed.length}편${changed.length ? ` (${changed.join(', ')})` : ''}${failed.length ? ` / 실패 ${failed.join(', ')}` : ''}`);
  if (failed.length) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) void main();
