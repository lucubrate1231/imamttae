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

/** 공유 미리보기·앱 소개 문구(D58, 10/7 기획). 달 이름 없음 · 작가 이름은 앱 문구에 넣지 않음 */
describe('공유 미리보기(카톡 카드)와 한 줄 메시지', () => {
  const html = readFileSync('index.html', 'utf8');
  const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8')) as { description: string };
  const meta = (attr: string) => html.match(new RegExp(`<meta ${attr} content="([^"]*)"`))?.[1];
  const ONE_LINE = '산악인 작가가 아내와 직접 다녀온, 지금 가면 딱 좋은 풍경';
  it('카톡 카드 제목·설명', () => {
    expect(meta('property="og:title"')).toBe('이맘때 풍경 — 지금 가면 딱 좋은 곳');
    expect(meta('property="og:description"')).toBe('산악인 작가가 아내와 직접 다녀온 곳만 모았어요');
  });
  it('앱 소개 자리(검색 설명·홈 화면 앱 설명)는 한 줄 메시지', () => {
    expect(meta('name="description"')).toBe(ONE_LINE);
    expect(manifest.description).toBe(ONE_LINE);
  });
  it('작가 이름이 없음', () => {
    expect(html).not.toContain('이상호');
    expect(manifest.description).not.toContain('이상호');
  });
});
