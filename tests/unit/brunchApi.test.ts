import { describe, expect, it } from 'vitest';
import { listPublished } from '../../pipeline/brunch/api';

describe('listPublished: 발행 목록을 끝까지 따라가며 모은다', () => {
  it('nextUrl 을 따라 여러 쪽을 모으고, 글 번호 순으로 정렬', async () => {
    const pages: Record<string, unknown> = {
      'https://api.brunch.co.kr/v2/article/@me': { data: { list: [{ no: 3, title: 'c', status: 'publish', contentHash: 'h3', publishTime: 3 }], nextUrl: 'p2' } },
      p2: { data: { list: [{ no: 1, title: 'a', status: 'publish', contentHash: 'h1', publishTime: 1 }], nextUrl: 'p3' } },
      p3: { data: { list: [], nextUrl: null } },
    };
    const fake = async (u: string) => pages[u];
    const list = await listPublished('me', fake);
    expect(list.map((x) => x.no)).toEqual([1, 3]);
    expect(list[0]).toEqual({ no: 1, title: 'a', contentHash: 'h1', publishTime: 1 });
  });
  it('발행 상태가 아닌 글은 뺀다', async () => {
    const fake = async () => ({ data: { list: [{ no: 1, title: 'a', status: 'draft' }], nextUrl: null } });
    expect(await listPublished('me', fake)).toEqual([]);
  });
  it('끝없이 이어지는 목록을 막는다(최대 50쪽)', async () => {
    let n = 0;
    const fake = async () => ({ data: { list: [{ no: ++n, title: 't', status: 'publish' }], nextUrl: 'again' } });
    const list = await listPublished('me', fake);
    expect(list.length).toBe(50);
  });
});
