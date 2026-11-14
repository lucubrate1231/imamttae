import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sitemapXml } from '../../src/domain/sitemap';

/** 검색 노출 켜기(D72, 11/14 프프 — 정식 출시 v1.0). 맨 앞 주소만 켜고, 미리보기(/next/)는 계속 막음 */
describe('검색 노출(D72)', () => {
  const html = readFileSync('index.html', 'utf8');
  const sh = readFileSync('scripts/publish-pages.sh', 'utf8');

  it('앱 첫 화면: 검색 막기(noindex)가 없고, 대표 주소(canonical)는 맨 앞 주소 — ?in=·?from= 이 붙은 주소가 따로 잡히지 않게', () => {
    expect(html).not.toMatch(/name="robots"/);
    expect(html).toContain('<link rel="canonical" href="https://imamttae.site/" />');
  });

  it('robots.txt: 모두 허용 + 사이트맵 주소', () => {
    expect(existsSync('public/robots.txt')).toBe(true);
    const lines = readFileSync('public/robots.txt', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
    expect(lines).toEqual(['User-agent: *', 'Allow: /', 'Sitemap: https://imamttae.site/sitemap.xml']);
  });

  it('사이트맵: 주소마다 <url>, 고친 날짜, 특수 글자는 안전하게', () => {
    const xml = sitemapXml('https://imamttae.site', ['/', '/s/a&b/'], '2026-11-14');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
    expect(xml).toContain('<url><loc>https://imamttae.site/</loc><lastmod>2026-11-14</lastmod></url>');
    expect(xml).toContain('<loc>https://imamttae.site/s/a&amp;b/</loc>');
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
  });

  it('빌드가 sitemap.xml을 내보냄', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toContain("fileName: 'sitemap.xml'");
  });

  it('미리보기(/next/)는 계속 검색에서 뺌: 올릴 때 noindex를 넣고 대표 주소 줄을 빼며, 안 들어갔으면 배포를 멈춤', () => {
    expect(sh).toContain(`sed -i 's#<head>#<head><meta name="robots" content="noindex, nofollow" />#' site/next/index.html`);
    expect(sh).toContain(`sed -i '/rel="canonical"/d' site/next/index.html`);
    expect(sh).toContain(`grep -q 'name="robots" content="noindex' site/next/index.html`);
  });
});
