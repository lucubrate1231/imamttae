/** 브런치 공개 API·페이지 가져오기. 발행된 글만 나옵니다(저장글은 404). */
import { extractArticle } from './parse';

export const PROFILE = 'caed5ea4c3d74d9';
const UA = { 'User-Agent': 'Mozilla/5.0 (imamttae content sync; +https://github.com/lucubrate1231/imamttae)' };

export interface PublishedItem {
  no: number;
  title: string;
  contentHash: string;
  publishTime: number;
}

type JsonGetter = (url: string) => Promise<unknown>;

const getJson: JsonGetter = async (url) => {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`브런치 목록 응답 ${r.status}`);
  return r.json();
};

export async function listPublished(profile = PROFILE, get: JsonGetter = getJson): Promise<PublishedItem[]> {
  const out = new Map<number, PublishedItem>();
  let url: string | null = `https://api.brunch.co.kr/v2/article/@${profile}`;
  for (let page = 0; url && page < 50; page++) {
    type Page = { data?: { list?: Record<string, unknown>[]; nextUrl?: string | null } };
    const res: Page = (await get(url)) as Page;
    const d = res.data;
    const list = d?.list ?? [];
    if (!list.length) break;
    for (const x of list) {
      if (x.status !== 'publish') continue;
      const no = Number(x.no);
      out.set(no, { no, title: String(x.title ?? ''), contentHash: String(x.contentHash ?? ''), publishTime: Number(x.publishTime ?? 0) });
    }
    url = d?.nextUrl ?? null;
  }
  return [...out.values()].sort((a, b) => a.no - b.no);
}

export async function fetchArticle(no: number, profile = PROFILE) {
  const url = `https://brunch.co.kr/@${profile}/${no}`;
  const r = await fetch(url, { headers: UA });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`브런치 글 ${no} 응답 ${r.status}`);
  const a = extractArticle(await r.text());
  return a ? { ...a, url } : null;
}
