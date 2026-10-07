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

/** 카톡 미리보기 그림(D58, 10/7 프프 최종 — 고래불 일출 #96) */
describe('카톡 미리보기 그림(og:image)', () => {
  const html = readFileSync('index.html', 'utf8');
  const meta = (attr: string) => html.match(new RegExp(`<meta ${attr} content="([^"]*)"`))?.[1];
  it('절대 주소(베타 주소) · 1200×630 · 대체 글', () => {
    expect(meta('property="og:image"')).toBe('https://imamttae.site/brand/og-image.jpg'); // D64 새 주소
    expect(meta('property="og:image:width"')).toBe('1200');
    expect(meta('property="og:image:height"')).toBe('630');
    expect(meta('property="og:image:alt"')).toBe('부서지는 파도 위로 떠오르는 해');
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
    expect(sh).toContain("sed -i 's#imamttae.site/brand/#imamttae.site/next/brand/#g' site/next/index.html site/next/s/*/index.html");
    expect(sh).toContain('echo imamttae.site > site/CNAME'); // D64: 배포마다 사이트 주소 파일을 지킴(지우면 GitHub 주소 연결이 풀림)
  });
});

/** 베타 자리(맨 앞 주소)의 '곧 문을 열어요' 안내(10/8) — v0.1.0 전까지. 옛 '이맘때 자연 · 지인 알파' 안내를 바꿈 */
describe('맨 앞 주소 준비 중 안내', () => {
  const sh = readFileSync('scripts/publish-pages.sh', 'utf8');
  it('미리보기를 올릴 때, 맨 앞이 아직 앱이 아니면(앱 파일 assets/main- 이 없으면) 안내를 새로 씀 — 앱이 올라간 뒤에는 건드리지 않음', () => {
    expect(sh).toContain("if [ ! -f site/index.html ] || ! grep -q 'assets/main-' site/index.html; then");
    expect(sh).toContain('<h1>이맘때 풍경</h1><p>곧 문을 열어요. 조금만 기다려 주세요.</p>');
    const start = sh.indexOf("cat > site/index.html <<'HTML'");
    const page = sh.slice(start, sh.indexOf('\nHTML', start));
    expect(page).not.toMatch(/이맘때 자연|알파/);
  });
});

/** 10/8: 사진 움직임 층(will-change)은 지금 움직이는 사진 하나에만 — 장마다 두면 아이폰이 메모리가 모자라 사진 일부를 그리지 못함 */
describe('사진 칸 스타일', () => {
  const css = readFileSync('src/styles/app.css', 'utf8');
  it('.kb에는 will-change를 두지 않고 .kb-on에만', () => {
    expect(css).not.toMatch(/\.kb \{[^}]*will-change/);
    expect(css).toMatch(/\.kb\.kb-on \{[^}]*will-change: transform/);
  });
  it('사진은 다 받기 전에는 투명, 다 받으면(.ready) 보임', () => {
    expect(css).toMatch(/\.gallery \.slide img \{[^}]*opacity: 0/);
    expect(css).toMatch(/\.gallery \.slide\.ready img \{[^}]*opacity: 1/);
  });
});
