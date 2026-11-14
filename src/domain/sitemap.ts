/**
 * 사이트맵(D72, 11/14 — 정식 출시 v1.0에 검색 노출을 켬). 검색엔진에 '이 주소들을 봐 주세요'라고 알리는 목록.
 * 빌드 때 sitemap.xml로 내보냄(vite.config.ts). 지금은 앱 첫 주소만 — 장면 공유 페이지(/s/)는 열면 바로 앱으로 넘어가는
 * 작은 페이지라 검색엔진이 첫 주소와 같은 페이지로 봄. 장면마다 검색에 잡히게 하려면 내용이 있는 페이지가 먼저 필요함(기획 결정 뒤).
 */
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sitemapXml(origin: string, paths: readonly string[], lastmod: string): string {
  const urls = paths.map((p) => `  <url><loc>${esc(origin + p)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
