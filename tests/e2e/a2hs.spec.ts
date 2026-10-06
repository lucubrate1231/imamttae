import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** 홈 화면에 두기(F5, D33) — design-guide 11장. 브라우저 이름표로 카톡 안·크롬·아이폰 사파리를 흉내 냄 */
const UA = {
  kakao: 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36 KAKAOTALK/25.8.0',
  chrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
};
const axe = async (page: Page, sel: string, what: string) => {
  const r = await new AxeBuilder({ page }).include(sel).analyze();
  expect(r.violations.map((v) => `${what} ${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};
const noOverflow = async (page: Page, sel: string) => expect(await page.$eval(sel, (e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(0);
const small = (page: Page, sel: string) =>
  page.$$eval(sel, (els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 10), r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 48)
      .map(({ t, r }) => `${t} ${Math.round(r.height)}px`),
  );

test.describe('카톡 안(안드로이드)', () => {
  test.use({ userAgent: UA.kakao });

  test('F5-AC4: 첫 화면 맨 위 띠 — 앱 아이콘과 함께 320px에서도 첫 줄은 한 줄, 띠 높이 64 이상, 하늘색, 접근성 위반 0', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./?map=fake&motion=0#/');
    const band = page.locator('main.home > .kband');
    await expect(band).toBeVisible();
    await page.evaluate(() => document.fonts.ready); // 앱 글꼴로 재야 함(첫 줄 약 202px, 320px에서 글 자리 205px — 디자인 #64)
    expect(await page.locator('.kb-l1').evaluate((e) => e.getClientRects().length === 1 && e.getBoundingClientRect().height < 26)).toBe(true);
    expect((await page.locator('.kb-go').boundingBox())!.height).toBeGreaterThanOrEqual(64);
    // 디자인 #64: 연한 하늘색 띠(계절과 상관없이), 링크 글자는 하늘 바탕에서 대비가 충분한 #2F5A7E, 앱 아이콘이 실제로 뜸
    const look = await page.evaluate(() => {
      const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
      const img = document.querySelector<HTMLImageElement>('.kb-ic')!;
      return { bg: cs('.kband').backgroundColor, line: cs('.kband').borderBottomColor, link: cs('.kb-l2').color, icon: img.complete && img.naturalWidth > 0 ? Math.round(img.getBoundingClientRect().width) : 0 };
    });
    expect(look).toEqual({ bg: 'rgb(220, 234, 246)', line: 'rgb(196, 215, 232)', link: 'rgb(47, 90, 126)', icon: 32 });
    expect(await small(page, '.kband button')).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await axe(page, '.kband', '띠');
  });

  test('띠를 눌러도 이 화면에 남으면 약 2초 뒤 "크롬이 열리지 않았나요?" 그림 안내', async ({ page }) => {
    await page.goto('./?map=fake&motion=0#/');
    await page.locator('.kb-go').click();
    const g = page.getByRole('dialog', { name: '크롬이 열리지 않았나요?' });
    await expect(g).toBeVisible({ timeout: 5000 });
    await axe(page, '.a2sheet', '카톡 안내');
    await g.getByRole('button', { name: '알겠어요' }).click();
    await expect(g).toHaveCount(0);
  });
});

test.describe('크롬(안드로이드)', () => {
  test.use({ userAgent: UA.chrome });

  test('D37·#101: 첫 방문부터 맨 위 "앱으로 설치하기" 띠 — 320px에서 첫 줄 한 줄, 하늘색, 높이 64 이상, 접근성 위반 0', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./?map=fake&motion=0#/');
    const band = page.locator('main.home > .kband');
    await expect(band.locator('.kb-l1')).toHaveText('앱으로 설치하면 바로 열 수 있어요');
    await expect(band.locator('.kb-l2')).toHaveText('앱으로 설치하기 ›');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator('.kb-l1').evaluate((e) => e.getClientRects().length === 1 && e.getBoundingClientRect().height < 26)).toBe(true);
    expect((await page.locator('.kb-go').boundingBox())!.height).toBeGreaterThanOrEqual(64);
    expect(await band.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(220, 234, 246)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await axe(page, '.kband', '앱으로 설치하기 띠');
  });

  test('F5-AC6·AC7: 처음 [저장] 직후 판 → [앱으로 설치하기] → 설치 창이 없으면 크롬 그림 안내(320×640 판 안 스크롤, 넘침 없음, 접근성)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./?map=fake&motion=0#/scene/s-020-naejangsan-uhwajeong');
    await expect(page.locator('.detail.open')).toBeVisible();
    await page.locator('.detail .dact[aria-pressed]').click();
    const s = page.getByRole('dialog', { name: '저장했어요' });
    await expect(s).toBeVisible();
    await expect.poll(() => s.locator('img.a2-icon').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(192);
    expect(await page.locator('.a2-ttl').evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)))).toBeLessThanOrEqual(2);
    await noOverflow(page, '.a2sheet');
    expect(await small(page, '.a2sheet button')).toEqual([]);
    await axe(page, '.a2sheet', '저장 판');
    await s.getByRole('button', { name: '앱으로 설치하기' }).click();
    const g = page.getByRole('dialog', { name: '앱으로 설치하는 방법' });
    await expect(g).toBeVisible();
    await expect(g.locator('.a2-step')).toHaveCount(3);
    const box = (await g.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(23); // 맨 위 24px는 남김
    await noOverflow(page, '.a2sheet');
    await axe(page, '.a2sheet', '크롬 안내');
  });

  test('[앱으로 설치하기] 카드: 앱 아이콘이 실제로 뜨고 "앱처럼 바로 열려요."', async ({ page }) => {
    await page.goto('./?map=fake&motion=0#/');
    const card = page.locator('main.home .home-add');
    await card.scrollIntoViewIfNeeded();
    await expect(card).toHaveText('앱으로 설치하기앱처럼 바로 열려요.');
    await expect.poll(() => card.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(192);
  });

  test('F5-AC8(#101): 설치를 마치면 설치 직후 판 — 320×640에서 넘침 없이, 제목 두 줄 안, 누르는 곳 48 이상, 접근성 위반 0, 띠는 사라짐', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./?map=fake&motion=0#/');
    await expect(page.locator('main.home > .kband')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    const s = page.getByRole('dialog', { name: '설치됐어요' });
    await expect(s).toBeVisible();
    await expect(page.locator('main.home > .kband')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    expect(await s.locator('.a2-ttl').evaluate((e) => Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)))).toBeLessThanOrEqual(2);
    await expect(s.locator('.a2-step')).toHaveCount(2);
    await noOverflow(page, '.a2sheet');
    expect(await small(page, '.a2sheet button')).toEqual([]);
    await axe(page, '.a2sheet', '설치 직후 판');
    await s.getByRole('button', { name: '알겠어요' }).click();
    await expect(s).toHaveCount(0);
  });
});

test.describe('아이폰 사파리', () => {
  test.use({ userAgent: UA.safari });

  test('F5-AC3: 처음 저장은 안내 줄 그대로, 카드는 사파리 그림 안내(320px, 접근성)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./?map=fake&motion=0#/scene/s-020-naejangsan-uhwajeong');
    await page.locator('.detail .dact[aria-pressed]').click();
    await expect(page.locator('.toast')).toContainText('저장했어요');
    await expect(page.locator('.a2sheet')).toHaveCount(0);
    await page.goto('./?map=fake&motion=0#/saved');
    await page.locator('.saved .home-add').click();
    const g = page.getByRole('dialog', { name: '홈 화면에 두는 방법' });
    await expect(g.locator('.a2-desc')).toHaveText('사파리 공유 버튼으로 할 수 있어요.');
    await noOverflow(page, '.a2sheet');
    await axe(page, '.a2sheet', '사파리 안내');
  });
});

test.describe('밴드 앱 안(안드로이드, D45 · 디자인 #107)', () => {
  test.use({ userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0 Mobile Safari/537.36 BAND/14.4.0' });

  test('카톡 안과 같은 띠(320px 첫 줄 한 줄·접근성) → 누른 뒤 이 화면이면 "밴드 메뉴로 열 수 있어요." 안내', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto('./?map=fake&motion=0#/');
    const band = page.locator('main.home > .kband');
    await expect(band.locator('.kb-l2')).toHaveText('크롬으로 열기 ›');
    await page.evaluate(() => document.fonts.ready);
    expect(await page.locator('.kb-l1').evaluate((e) => e.getClientRects().length === 1 && e.getBoundingClientRect().height < 26)).toBe(true);
    await axe(page, '.kband', '밴드 띠');
    await page.locator('.kb-go').click();
    const g = page.getByRole('dialog', { name: '크롬이 열리지 않았나요?' });
    await expect(g).toBeVisible({ timeout: 5000 });
    await expect(g.locator('.a2-desc')).toHaveText('밴드 메뉴로 열 수 있어요.');
    await noOverflow(page, '.a2sheet');
    await axe(page, '.a2sheet', '밴드 안내');
  });

  test('실기기 확인 페이지 ⑤: 밴드 앱 안으로 알아보고, 넘기기 버튼 셋과 메뉴 이름 칸, 결과에 함께 담김', async ({ page }) => {
    await page.goto('./_review/a2hs-lab.html');
    await expect(page.locator('.state')).toContainText('밴드 앱 안 화면');
    await expect(page.getByRole('link', { name: '⑤ 크롬으로 열기(안드로이드)' })).toHaveAttribute('href', /^intent:\/\//);
    await expect(page.getByRole('link', { name: '⑤ 사파리로 열기(아이폰)' })).toHaveAttribute('href', /^x-safari-https?:\/\//);
    await page.getByRole('textbox', { name: '바깥 브라우저로 여는 메뉴 이름' }).fill('오른쪽 위 ⋯ → 다른 브라우저로 열기');
    await page.getByRole('textbox', { name: '바깥 브라우저로 여는 메뉴 이름' }).blur();
    await expect(page.locator('.log')).toContainText('메뉴 이름 적음');
  });
});
