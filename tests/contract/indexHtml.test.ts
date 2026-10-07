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

/** 카톡 미리보기 그림(D58, 10/7 프프 — 화산 풍차전망대 운해 #65) */
describe('카톡 미리보기 그림(og:image)', () => {
  const html = readFileSync('index.html', 'utf8');
  const meta = (attr: string) => html.match(new RegExp(`<meta ${attr} content="([^"]*)"`))?.[1];
  it('절대 주소(베타 주소) · 1200×630 · 대체 글', () => {
    expect(meta('property="og:image"')).toBe('https://lucubrate1231.github.io/imamttae/brand/og-image.jpg');
    expect(meta('property="og:image:width"')).toBe('1200');
    expect(meta('property="og:image:height"')).toBe('630');
    expect(meta('property="og:image:alt"')).toBe('겹겹이 이어진 산줄기 사이로 깔린 구름바다');
  });
  it('그림 파일이 정말 1200×630 JPEG(카톡 카드 1.91:1)', () => {
    const b = readFileSync('public/brand/og-image.jpg');
    expect(b.subarray(0, 2).toString('hex')).toBe('ffd8');
    let i = 2;
    let size = '';
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1]!;
      if (m >= 0xc0 && m <= 0xc2) { size = `${b.readUInt16BE(i + 7)}x${b.readUInt16BE(i + 5)}`; break; }
      i += 2 + b.readUInt16BE(i + 2);
    }
    expect(size).toBe('1200x630');
    expect(b.length).toBeLessThan(300_000); // 카톡이 빨리 받게
  });
  it('미리보기(/next/)에 올릴 때는 그림 주소를 /next/ 쪽으로 바꿈(베타 주소에는 v0.1.0 전까지 그림이 없음)', () => {
    const sh = readFileSync('scripts/publish-pages.sh', 'utf8');
    expect(sh).toMatch(/sed -i 's#github\.io\/imamttae\/brand\/#github\.io\/imamttae\/next\/brand\/#g' site\/next\/index\.html/);
  });
});
