import { expect, test, type CDPSession, type Page } from '@playwright/test';

/**
 * 명조(고운바탕) 글자 깨짐 (10/3 사용자 발견: 시안 제목의 '덮·밭·쭉·릇'이 잠깐 고딕으로 보임)
 * 글꼴 '이름'이 아니라 글자마다 '실제로 그린 글꼴'을 크롬에 물어 확인합니다(CSS.getPlatformFontsForNode).
 * - 글꼴 파일이 늦게 와도 한 제목 안에서 명조와 다른 글꼴이 섞여 보이면 안 됩니다.
 * - 다 받은 뒤에는 제목·작가의 한마디의 모든 글자가 고운바탕이어야 합니다.
 */
const DISPLAY = '.ttl, .big .cap b, .rec b, .records h2';

async function cdpFor(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  return cdp;
}

/** 선택한 요소마다 실제로 그린 글꼴 이름들 */
async function renderedFonts(page: Page, cdp: CDPSession, selector: string): Promise<{ text: string; fonts: string[] }[]> {
  const { root } = await cdp.send('DOM.getDocument', { depth: -1 });
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: root.nodeId, selector });
  // 화면에 그려지지 않은 요소(숨긴 구역)는 글꼴이 없으므로 뺌
  const texts = await page.$$eval(selector, (els) => els.map((e) => (e.getClientRects().length ? (e.textContent ?? '').trim() : '')));
  const out: { text: string; fonts: string[] }[] = [];
  for (let i = 0; i < nodeIds.length; i++) {
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: nodeIds[i]! });
    if (texts[i]) out.push({ text: texts[i]!, fonts: fonts.map((f) => f.familyName) });
  }
  return out;
}

const isFontFile = (url: string) => /\.(woff2?|ttf|otf)(\?|$)/.test(url);

/**
 * 막으려는 것: 한 제목 안에서 **고운바탕과 다른 글꼴이 함께** 쓰이는 섞임(구글 조각 시절의 '덮·밭·쭉·릇').
 * 제목 글꼴 파일이 통째로 안 오면 제목 전체가 휴대폰 기본 글꼴로 그려지는 것은 정상입니다.
 * (10/4 바로잡음: 리눅스 기본 글꼴은 숫자와 한글을 다른 글꼴로 그려서, '글꼴이 둘 이상이면 실패'로 보면 GitHub에서만 잘못 실패했음)
 */
const gowunMixed = (rows: { text: string; fonts: string[] }[]) =>
  rows.filter((r) => r.fonts.includes('Gowun Batang') && r.fonts.some((f) => f !== 'Gowun Batang')).map((m) => `"${m.text}" ← ${m.fonts.join(' + ')}`);

for (const [name, block] of [
  ['글꼴 파일을 하나 걸러 하나씩 막아도', (n: number) => n % 2 === 1],
  ['제목 글꼴 파일만 막아도', (_n: number, url: string) => url.includes('gowun-batang-title')],
] as const) {
  test(`${name} 한 제목 안에서 고운바탕과 다른 글꼴이 섞이지 않음`, async ({ page }) => {
    await page.route('**/dapi.kakao.com/**', (r) => r.abort());
    let n = 0;
    await page.route((url) => isFontFile(url.href), async (r) => {
      if (block(n++, r.request().url())) return r.abort();
      await r.fallback();
    });
    const cdp = await cdpFor(page);
    await page.goto('./_review/v2.html?m=9');
    await page.locator('.big').first().waitFor();
    await page.waitForTimeout(2500); // 올 파일은 다 오고, 막힌 파일은 실패로 끝난 뒤
    expect(gowunMixed(await renderedFonts(page, cdp, DISPLAY))).toEqual([]);
  });
}

test('다 받은 뒤에는 제목·작가의 한마디의 모든 글자가 고운바탕(여러 달, 장면 상세 포함)', async ({ page }) => {
  await page.route('**/dapi.kakao.com/**', (r) => r.abort());
  const cdp = await cdpFor(page);
  const bad: string[] = [];
  const settle = async () => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.evaluate(() => document.fonts.ready);
  };
  for (const m of [1, 4, 5, 9, 10]) {
    await page.goto(`./_review/v2.html?m=${m}`);
    await page.locator('.big').first().waitFor();
    await settle();
    for (const r of await renderedFonts(page, cdp, DISPLAY)) if (r.fonts.join() !== 'Gowun Batang') bad.push(`${m}월 "${r.text}" ← ${r.fonts.join(' + ')}`);
  }
  await page.goto('./_review/v2.html?m=9');
  await page.locator('.big').nth(1).click(); // 함양 상림 꽃무릇: 작가의 한마디에 '덮'이 있음
  await expect(page.locator('.detail.open')).toBeVisible();
  await settle();
  for (const r of await renderedFonts(page, cdp, '.detail .title, .detail .quote p')) if (r.fonts.join() !== 'Gowun Batang') bad.push(`상세 "${r.text.slice(0, 20)}" ← ${r.fonts.join(' + ')}`);
  expect(bad).toEqual([]);
});

test('이용 안내와 개인정보(#/privacy) 제목·구역 제목도 모든 글자가 고운바탕(10/7)', async ({ page }) => {
  const cdp = await cdpFor(page);
  await page.goto('./?map=fake&motion=0#/privacy');
  await expect(page.locator('.privacy h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.evaluate(() => document.fonts.ready);
  const rows = await renderedFonts(page, cdp, '.privacy .pv-title, .privacy .pv-zone');
  expect(rows.map((r) => r.text)).toEqual(['이용 안내와 개인정보', '이 앱의 정보는', '개인정보']);
  expect(rows.filter((r) => r.fonts.join() !== 'Gowun Batang').map((r) => `"${r.text}" ← ${r.fonts.join(' + ')}`)).toEqual([]);
});
