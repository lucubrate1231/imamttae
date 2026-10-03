import { describe, expect, it } from 'vitest';
import { parseRoute, routeHref } from '../../src/domain/router';

describe('parseRoute: 카카오톡으로 받은 링크가 해당 화면으로 바로 열린다', () => {
  it.each([
    ['', { name: 'month', month: null }],
    ['#/', { name: 'month', month: null }],
    ['#/month/10', { name: 'month', month: 10 }],
    ['#/month/13', { name: 'month', month: null }],
    ['#/find', { name: 'find', type: null }],
    ['#/find/danpung', { name: 'find', type: 'danpung' }],
    ['#/find/없는장면', { name: 'find', type: null }],
    ['#/scene/s-019-buseoksa', { name: 'scene', id: 's-019-buseoksa' }],
    ['#/stamps', { name: 'stamps' }],
    ['#/이상한주소', { name: 'month', month: null }],
  ])('%j', (hash, want) => {
    expect(parseRoute(hash)).toEqual(want);
  });

  it('routeHref ↔ parseRoute 왕복', () => {
    const r = { name: 'find', type: 'unhae' } as const;
    expect(parseRoute(routeHref(r))).toEqual(r);
  });
});
