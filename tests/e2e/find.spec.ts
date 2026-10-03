import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** 풍경 찾기(F3) 사용 흐름 — 가짜 지도(?map=fake) */
async function open(page: Page, hash = '#/find'): Promise<void> {
  await page.goto(`./?map=fake&motion=0${hash}`);
  await page.locator('.find:not([hidden])').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test('F3-AC1: 아래 메뉴 "풍경 찾기" → 고르기 화면, "지금 풍경"으로 돌아옴', async ({ page }) => {
  await page.goto('./?map=fake#/month/10');
  await page.getByRole('button', { name: '풍경 찾기', exact: true }).click();
  await expect(page).toHaveURL(/#\/find$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('어떤 풍경이 보고 싶으세요?');
  await page.getByRole('button', { name: '지금 풍경', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /월에 만나는 풍경/ })).toBeVisible();
});

test('타일 → 풍경 화면 → 목록 줄 → 장면 상세 → 뒤로 → 다시 풍경 화면 → ‹ 풍경 찾기', async ({ page }) => {
  await open(page);
  await page.locator('.sec-good .tile').first().click();
  await expect(page).toHaveURL(/#\/find\/[a-z]+$/);
  const title = await page.getByRole('heading', { level: 1 }).textContent();
  await page.locator('.find-list .row').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.locator('.detail .back').click();
  await expect(page.locator('.detail.open')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title!);
  await page.locator('.find-back').click();
  await expect(page).toHaveURL(/#\/find$/);
});

test('F3-AC7: 권역 칩을 고르면 주소가 바뀌고 칩이 계절 색으로 채워짐', async ({ page }) => {
  await open(page, '#/find/danpung');
  const chip = page.locator('.find-chips .chip').nth(1);
  await chip.click();
  await expect(page).toHaveURL(/#\/find\/danpung\/[a-z]+$/);
  await expect(page.locator('.find-chips .chip').nth(1)).toHaveAttribute('aria-pressed', 'true');
});

test('F3-AC3: "N월에 좋은 곳 더 보기"를 누르면 그 묶음이 펼쳐짐', async ({ page }) => {
  await open(page, '#/find/unhae');
  const before = await page.locator('.find-list .row:visible').count();
  await page.locator('.more').first().click();
  await expect.poll(async () => page.locator('.find-list .row:visible').count()).toBeGreaterThan(before);
});

test('C-1: 320px 폭에서 고르기·풍경 화면 모두 가로로 밀리지 않음', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const hash of ['#/find', '#/find/danpung', '#/find/eoksae', '#/find/all/gangwon']) {
    await open(page, hash);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), hash).toBeLessThanOrEqual(0);
  }
});

test('C-2: 풍경 찾기의 누르는 곳은 48px 이상', async ({ page }) => {
  for (const hash of ['#/find', '#/find/danpung']) {
    await open(page, hash);
    const small = await page.$$eval('.find button, .find a', (els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null)
        .map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 12), r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.height < 48)
        .map(({ t, r }) => `${t} ${Math.round(r.height)}px`),
    );
    expect(small, hash).toEqual([]);
  }
});

test('C-3: 풍경 찾기 접근성 검사(axe) 위반 0', async ({ page }) => {
  for (const hash of ['#/find', '#/find/danpung', '#/find/eoksae']) {
    await open(page, hash);
    const r = await new AxeBuilder({ page }).include('.find').analyze();
    expect(r.violations.map((v) => `${hash} ${v.id}: ${v.help}`)).toEqual([]);
  }
});
