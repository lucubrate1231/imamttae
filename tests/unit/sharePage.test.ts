import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ContentFile } from '../../shared/schema/content';
import appData from '../../public/data/scenes.json';
import { COMMON_IMAGE, redirectTarget, shareCard, sharePageHtml, sharePages } from '../../src/domain/sharePage';
import { story } from '../fixtures/homeScenes';

/** 장면별 카톡 미리보기(D63, 10/7 프프 — 백로그 ★3·D15를 당김) */
const content = ContentFile.parse(appData);
const visible = content.scenes.filter((s) => s.kind === 'story' && !s.hidden);

describe('카드 정보(작가 이름 없이 — D58·D59, "제철"은 쓰지 않음 — D12)', () => {
  const s = story('s-x', { name: '내장산 우화정', region: '전북 정읍', visited: '2021-11-09', best: { from: 10, to: 11, note: '10월 말~11월 초' } });
  it('제목 "{장면 이름} — 이맘때 풍경", 설명 "{지역} · 산악인 작가가 아내와 다녀온 곳"(마케팅 M12, 10/8 — 지역이 모두 5자라 25자, 아이폰에서 안 잘림)', () => {
    const c = shareCard(s);
    expect(c.title).toBe('내장산 우화정 — 이맘때 풍경');
    expect(c.description).toBe('전북 정읍 · 산악인 작가가 아내와 다녀온 곳');
    expect(shareCard({ ...s, best: undefined }).description).toBe('전북 정읍 · 산악인 작가가 아내와 다녀온 곳');
  });
  it('M12: 실제 장면 카드 설명은 모두 25자 이하', () => {
    for (const v of visible) expect([...shareCard(v as never).description].length, v.id).toBeLessThanOrEqual(25);
  });
  it('그림은 그 장면의 첫 사진을 1200×630으로 가운데 맞춰 자른 카카오 썸네일, 다음 후보로 앱 공통 그림', () => {
    const c = shareCard(s);
    expect(c.image).toBe(`https://img1.daumcdn.net/thumb/C1200x630.q75/?fname=${encodeURIComponent(s.photos[0]!.src)}`);
    expect(c.fallbackImage).toBe(COMMON_IMAGE);
    expect(COMMON_IMAGE).toBe('https://imamttae.site/brand/og-image.jpg'); // D64 새 주소
  });
  it('실제 장면 모두: 작가 이름·"제철"이 없음', () => {
    for (const v of visible) {
      const c = shareCard(v as never);
      expect(`${c.title} ${c.description}`).not.toMatch(/이상호|제철/);
    }
  });
});

describe('공유 페이지(/s/<장면 번호>/)', () => {
  const s = story('s-x', { name: '바위 & "절벽" <길>', region: '강원 인제', visited: '2020-10-20', best: { from: 10, to: 10, note: '10월' } });
  const html = sharePageHtml(s);
  const meta = (p: string) => html.match(new RegExp(`<meta property="${p}" content="([^"]*)"`))?.[1];
  it('카드 정보(og)와 크기, 검색 막기(noindex, 정식 출시 전까지)', () => {
    expect(meta('og:title')).toBe('바위 &amp; &quot;절벽&quot; &lt;길&gt; — 이맘때 풍경');
    expect(meta('og:image')).toContain('img1.daumcdn.net/thumb/C1200x630');
    expect(meta('og:image:width')).toBe('1200');
    expect(meta('og:image:height')).toBe('630');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).toContain('<title>바위 &amp; &quot;절벽&quot; &lt;길&gt; — 이맘때 풍경</title>');
  });
  it('열면 바로 앱의 그 장면으로(주소 뒤 ?from=share 등은 그대로) — 스크립트가 꺼져도 넘어가는 줄과 누르는 링크', () => {
    expect(html).toContain(`location.replace(${JSON.stringify('../../')} + location.search + ${JSON.stringify('#/scene/s-x')})`);
    expect(html).toContain('<meta http-equiv="refresh" content="0; url=../../#/scene/s-x" />');
    expect(html).toContain('<a href="../../#/scene/s-x">');
  });
  it('redirectTarget: 공유 페이지 → 앱 주소', () => {
    expect(redirectTarget('s-013-daeseung-falls', '?from=share')).toBe('../../?from=share#/scene/s-013-daeseung-falls');
  });
});

describe('공유 페이지 목록', () => {
  it('보이는 장면 수 = 공유 페이지 수, 숨긴 장면·준비 중 글은 만들지 않음, 주소는 s/<번호>/index.html', () => {
    const pages = sharePages(content);
    expect(pages).toHaveLength(visible.length);
    expect(new Set(pages.map((p) => p.fileName)).size).toBe(pages.length);
    expect(pages.map((p) => p.fileName)).toEqual(visible.map((s) => `s/${s.id}/index.html`));
    const hidden = content.scenes.filter((s) => s.kind === 'story' && s.hidden);
    for (const h of hidden) expect(pages.some((p) => p.fileName.includes(h.id))).toBe(false);
  });
});

describe('없어진 장면 주소(404.html) — 멈추지 않고 앱 첫 화면으로', () => {
  const html = readFileSync('public/404.html', 'utf8');
  const homeFor = new Function(`${html.match(/function homeFor[\s\S]*?\n {4}\}/)![0]}; return homeFor;`)() as (p: string) => string;
  it('미리보기·베타의 공유 페이지 주소면 그 앱의 첫 화면으로(?from=share는 그대로 붙여 감) — 새 주소(D64)·옛 주소 둘 다', () => {
    expect(homeFor('/next/s/s-old-scene/')).toBe('/next/');
    expect(homeFor('/s/s-old-scene/')).toBe('/');
    expect(homeFor('/imamttae/next/s/s-old-scene/')).toBe('/imamttae/next/');
    expect(homeFor('/imamttae/s/s-old-scene/')).toBe('/imamttae/');
    expect(html).toContain('location.replace(homeFor(location.pathname) + location.search)');
  });
  it('그 밖의 없는 주소도 미리보기면 미리보기 첫 화면, 아니면 베타 첫 화면', () => {
    expect(homeFor('/next/없는/곳')).toBe('/next/');
    expect(homeFor('/없는')).toBe('/');
    expect(homeFor('/imamttae/next/없는/곳')).toBe('/imamttae/next/');
    expect(homeFor('/imamttae/없는')).toBe('/imamttae/');
  });
  it('검색 막기 · 미리보기에 올릴 때도 사이트 맨 위(GitHub이 쓰는 자리)에 둠', () => {
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(readFileSync('scripts/publish-pages.sh', 'utf8')).toContain('cp dist/404.html site/404.html');
  });
});
