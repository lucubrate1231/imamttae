import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** #77: 카카오 지도 서버에 미리 연결해 SDK·지도 그림을 더 빨리 받음 */
describe('index.html', () => {
  const html = readFileSync('index.html', 'utf8');
  it.each(['https://dapi.kakao.com', 'https://t1.daumcdn.net', 'https://mts.daumcdn.net'])('%s 에 preconnect·dns-prefetch', (host) => {
    expect(html).toContain(`<link rel="preconnect" href="${host}"`);
    expect(html).toContain(`<link rel="dns-prefetch" href="${host}"`);
  });
});
