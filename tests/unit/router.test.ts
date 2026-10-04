import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref, type Route } from '../../src/domain/router';

describe('parseRoute: 카카오톡으로 받은 링크가 해당 화면으로 바로 열린다', () => {
  it.each([
    ['', { name: 'month', month: null }],
    ['#/', { name: 'month', month: null }],
    ['#/month/10', { name: 'month', month: 10 }],
    ['#/month/13', { name: 'month', month: null }],
    ['#/find', { name: 'find', type: null, region: null }],
    ['#/find/danpung', { name: 'find', type: 'danpung', region: null }],
    ['#/find/없는장면', { name: 'find', type: null, region: null }],
    ['#/scene/s-019-buseoksa', { name: 'scene', id: 's-019-buseoksa' }],
    ['#/saved', { name: 'saved' }], // 저장한 곳(F4, D24)
    ['#/stamps', { name: 'saved' }], // 옛 주소(내 수첩)도 저장한 곳으로
    ['#/이상한주소', { name: 'month', month: null }],
  ])('%j', (hash, want) => {
    expect(parseRoute(hash)).toEqual(want);
  });

  it('저장한 곳 주소는 #/saved', () => {
    expect(routeHref({ name: 'saved' })).toBe('#/saved');
  });

  it('routeHref ↔ parseRoute 왕복', () => {
    const r = { name: 'find', type: 'unhae', region: null } as const;
    expect(parseRoute(routeHref(r))).toEqual(r);
  });
});

describe('풍경 찾기 주소의 권역 (F3-AC2·AC7)', () => {
  it.each([
    ['#/find/all/gangwon', { name: 'find', type: null, region: 'gangwon' }],
    ['#/find/danpung/gangwon', { name: 'find', type: 'danpung', region: 'gangwon' }],
    ['#/find/bada/gyeongsang', { name: 'find', type: 'bada', region: 'gyeongsang' }],
    ['#/find/all/jeolla', { name: 'find', type: null, region: 'jeolla' }],
    ['#/find/all/chungcheong', { name: 'find', type: null, region: 'chungcheong' }],
    ['#/find/all/sudogwon', { name: 'find', type: null, region: 'sudogwon' }],
    ['#/find/all', { name: 'find', type: null, region: null }],
    ['#/find/danpung/jeju', { name: 'find', type: 'danpung', region: null }],
    ['#/find/없는풍경/gangwon', { name: 'find', type: null, region: 'gangwon' }],
    ['#/find/없는풍경/없는권역', { name: 'find', type: null, region: null }],
    ['#/find/__proto__/constructor', { name: 'find', type: null, region: null }],
    ['#/find/%64anpung/%67angwon', { name: 'find', type: 'danpung', region: 'gangwon' }],
    ['#/find/%E0%A4%A/gangwon', { name: 'find', type: null, region: 'gangwon' }],
  ])('%s에서 모르는 값은 각 칸만 null', (hash, want) => {
    expect(parseRoute(hash)).toEqual(want);
  });

  it.each<[Route, string]>([
    [{ name: 'find', type: null, region: null }, '#/find'],
    [{ name: 'find', type: 'danpung', region: null }, '#/find/danpung'],
    [{ name: 'find', type: null, region: 'gangwon' }, '#/find/all/gangwon'],
    [{ name: 'find', type: 'danpung', region: 'gangwon' }, '#/find/danpung/gangwon'],
    [{ name: 'find', type: 'bada', region: 'gyeongsang' }, '#/find/bada/gyeongsang'],
    [{ name: 'find', type: null, region: 'jeolla' }, '#/find/all/jeolla'],
    [{ name: 'find', type: null, region: 'chungcheong' }, '#/find/all/chungcheong'],
    [{ name: 'find', type: null, region: 'sudogwon' }, '#/find/all/sudogwon'],
  ])('%j의 주소를 만들고 다시 읽어도 같은 선택', (route, href) => {
    expect(routeHref(route)).toBe(href);
    expect(parseRoute(href)).toEqual(route);
  });
});
