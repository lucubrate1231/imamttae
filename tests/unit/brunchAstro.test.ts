import { describe, expect, it } from 'vitest';
import { unwrapAstro, extractArticle } from '../../pipeline/brunch/parse';

describe('unwrapAstro: 브런치 페이지 안의 데이터 포장(Astro 직렬화)을 푼다', () => {
  it('[0, 값] 은 값, [1, 배열] 은 배열', () => {
    expect(unwrapAstro([0, 'a'])).toBe('a');
    expect(unwrapAstro([1, [[0, 1], [0, 2]]])).toEqual([1, 2]);
  });
  it('객체 안쪽까지 푼다', () => {
    expect(unwrapAstro([0, { no: [0, 5], tags: [1, [[0, 'x']]] }])).toEqual({ no: 5, tags: ['x'] });
  });
  it('포장되지 않은 값은 그대로', () => {
    expect(unwrapAstro('plain')).toBe('plain');
    expect(unwrapAstro(null)).toBeNull();
  });
});

function pageWith(article: Record<string, unknown>): string {
  const wrap = (v: unknown): unknown => (Array.isArray(v) ? [1, v.map(wrap)] : v && typeof v === 'object' ? [0, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wrap(x)]))] : [0, v]);
  const props = { article: wrap(article) };
  const attr = JSON.stringify(props).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return `<html><body><astro-island uid="x" component-export="ArticleProviderWithQuery" props="${attr}"></astro-island></body></html>`;
}

describe('extractArticle: 글 페이지 HTML에서 글 데이터를 꺼낸다', () => {
  const content = JSON.stringify({ body: [{ type: 'text', data: [{ type: 'text', text: '20년 5월 14일' }] }] });
  it('발행된 글', () => {
    const a = extractArticle(pageWith({ no: 8, title: '여덟 번째 여행', subTitle: '부제', status: 'publish', publishTime: 1, updateTime: 2, contentHash: 'h', content }));
    expect(a).toMatchObject({ no: 8, title: '여덟 번째 여행', status: 'publish', contentHash: 'h' });
    expect(a?.content.body).toHaveLength(1);
  });
  it('발행되지 않은 글은 null', () => {
    expect(extractArticle(pageWith({ no: 9, title: 't', status: 'draft', content }))).toBeNull();
  });
  it('글 데이터가 없는 페이지(구조 변경 등)는 null', () => {
    expect(extractArticle('<html>nothing</html>')).toBeNull();
  });
});
