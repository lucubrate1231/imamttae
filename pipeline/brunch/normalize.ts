/**
 * 브런치 원본 글 → 앱용 이야기(Story). 기존 Python(brunch_normalize.py)과 같은 결과를 내도록 옮겼습니다.
 * 다른 점: 사진 주소를 https + t1.kakaocdn.net 으로 통일합니다(t1.daumcdn.net 은 썸네일 서비스에서 막힘).
 */
import { findDateLine, parseVisitDate, type VisitDate } from '../../src/domain/dateLine';
import type { RawArticle, RawNode } from './parse';

export interface Photo { src: string; cap: string; w: number; h: number }
export type StoryItem =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string }
  | ({ t: 'img' } & Photo)
  | { t: 'gallery'; imgs: Photo[]; cap: string }
  | { t: 'video' }
  | { t: 'hr' };

export interface Story {
  brunchNo: number;
  title: string;
  subtitle: string;
  url: string;
  publishTime: number | null;
  contentHash: string;
  dateLine: string | null;
  visit: VisitDate | null;
  intro: string[];
  cover: string | null;
  photoCount: number;
  sections: string[];
  items: StoryItem[];
}

export function normalizePhotoUrl(u: string): string {
  return u.replace(/^http:\/\//, 'https://').replace(/^https:\/\/t1\.daumcdn\.net\//, 'https://t1.kakaocdn.net/');
}

function flat(node: RawNode | RawNode[] | undefined): string {
  if (!node) return '';
  if (Array.isArray(node)) return node.map(flat).join('');
  if (node.type === 'br') return '\n';
  let s = node.type === 'text' && typeof node.text === 'string' ? node.text : '';
  if (Array.isArray(node.data)) s += node.data.map(flat).join('');
  return s;
}

const num = (v: unknown) => Math.trunc(Number(v ?? 0)) || 0;
const photo = (url: string, cap: unknown, w: unknown, h: unknown): Photo => ({ src: normalizePhotoUrl(url), cap: String(cap ?? '').trim(), w: num(w), h: num(h) });

export type ArticleInput = Omit<RawArticle, 'status'> & { status?: string; url?: string };

export function normalizeArticle(a: ArticleInput): Story {
  const items: StoryItem[] = [];
  for (const b of a.content.body) {
    switch (b.type) {
      case 'text': {
        const s = flat({ type: 'wrap', data: b.data }).trim();
        if (!s) break;
        items.push({ t: b.size === 'h2' || b.size === 'h3' ? 'h2' : 'p', text: s });
        break;
      }
      case 'img':
        if (b.url) items.push({ t: 'img', ...photo(b.url, b.caption, b.width, b.height) });
        break;
      case 'gridGallery':
        items.push({ t: 'gallery', imgs: (b.gridImages ?? []).map((g) => photo(g.url, g.caption, g.width, g.height)), cap: String(b.caption ?? '').trim() });
        break;
      case 'video':
        items.push({ t: 'video' });
        break;
      case 'hr':
        items.push({ t: 'hr' });
        break;
    }
  }

  const dateLine = findDateLine(items as { t: string; text?: string }[]);
  const intro: string[] = [];
  for (const it of items) {
    if (it.t === 'h2') break;
    if (it.t === 'p' && it.text !== dateLine) intro.push(it.text);
  }
  const photos = [
    ...items.filter((x): x is { t: 'img' } & Photo => x.t === 'img'),
    ...items.flatMap((x) => (x.t === 'gallery' ? x.imgs : [])),
  ];
  const coverRaw = a.content.cover?.style?.['background-image'];
  return {
    brunchNo: a.no,
    title: a.title.trim(),
    subtitle: (a.subTitle ?? '').trim(),
    url: a.url ?? `https://brunch.co.kr/@caed5ea4c3d74d9/${a.no}`,
    publishTime: a.publishTime ?? null,
    contentHash: a.contentHash ?? '',
    dateLine,
    visit: dateLine ? parseVisitDate(dateLine) : null,
    intro,
    cover: coverRaw ? normalizePhotoUrl(coverRaw) : (photos[0]?.src ?? null),
    photoCount: photos.length,
    sections: items.filter((x): x is { t: 'h2'; text: string } => x.t === 'h2').map((x) => x.text),
    items,
  };
}
