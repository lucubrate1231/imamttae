/**
 * 브런치 글 페이지 HTML에서 글 데이터를 꺼냅니다.
 * 페이지 안 <astro-island component-export="ArticleProviderWithQuery" props="…"> 에 글이 들어 있습니다.
 * 브런치가 페이지 구조를 바꾸면 null을 돌려주고, 동기화는 그 글을 건너뛰고 알림을 남깁니다.
 */
export interface RawArticle {
  no: number;
  title: string;
  subTitle?: string | null;
  status: string;
  publishTime?: number;
  updateTime?: number;
  contentHash?: string;
  url?: string;
  content: { cover?: { style?: Record<string, string> }; body: RawBlock[] };
}
export interface RawBlock {
  type: string;
  size?: string;
  data?: RawNode[];
  url?: string;
  caption?: string | null;
  width?: number | string;
  height?: number | string;
  gridImages?: { url: string; caption?: string | null; width?: number | string; height?: number | string }[];
}
export interface RawNode {
  type: string;
  text?: string;
  data?: RawNode[];
}

/** Astro 직렬화: [0, 값] = 값(객체면 안쪽까지), [1, 배열] = 배열 */
export function unwrapAstro(v: unknown): unknown {
  if (Array.isArray(v) && v.length === 2 && typeof v[0] === 'number') {
    const [t, val] = v as [number, unknown];
    if (t === 0) {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        return Object.fromEntries(Object.entries(val as Record<string, unknown>).map(([k, x]) => [k, unwrapAstro(x)]));
      }
      return val;
    }
    if (t === 1 && Array.isArray(val)) return val.map(unwrapAstro);
    return val;
  }
  return v;
}

const ENTITIES: Record<string, string> = { '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#39;': "'", '&#x27;': "'" };
function unescapeHtml(s: string): string {
  return s.replace(/&(quot|amp|lt|gt|#39|#x27);/g, (m) => ENTITIES[m] ?? m);
}

export function extractArticle(html: string): (RawArticle & { content: RawArticle['content'] }) | null {
  const m = /component-export="ArticleProviderWithQuery"[^>]*?props="([^"]*)"/.exec(html);
  if (!m?.[1]) return null;
  let props: { article?: unknown };
  try {
    props = JSON.parse(unescapeHtml(m[1])) as { article?: unknown };
  } catch {
    return null;
  }
  const a = unwrapAstro(props.article) as Record<string, unknown> | null;
  if (!a || a.status !== 'publish' || typeof a.content !== 'string') return null;
  let content: RawArticle['content'];
  try {
    content = JSON.parse(a.content) as RawArticle['content'];
  } catch {
    return null;
  }
  return {
    no: Number(a.no),
    title: String(a.title ?? ''),
    subTitle: (a.subTitle as string | null | undefined) ?? null,
    status: 'publish',
    publishTime: a.publishTime as number | undefined,
    updateTime: a.updateTime as number | undefined,
    contentHash: a.contentHash as string | undefined,
    content,
  };
}
