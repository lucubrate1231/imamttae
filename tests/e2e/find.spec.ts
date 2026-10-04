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
  // 주소가 먼저 바뀌고 화면은 그 뒤에 바뀜 → 결과 화면 제목이 뜬 뒤에 읽음(전에는 고르기 화면 제목을 읽어 가끔 실패)
  const resultTitle = page.locator('.find-head.result h1');
  await expect(resultTitle).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('어떤 풍경이 보고 싶으세요?');
  const title = await resultTitle.textContent();
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

test('D28~D30: 첫 화면·풍경 찾기에 "제철"·"작가 부부"·"가고 싶어요"라는 말이 없음', async ({ page }) => {
  for (const hash of ['#/month/10', '#/month/8', '#/find', '#/find/danpung', '#/find/eoksae']) {
    await page.goto(`./?map=fake&motion=0${hash}`);
    await page.locator('#app main:not([hidden]), #app .find:not([hidden])').first().waitFor();
    const words = await page.evaluate(() => {
      const t = [...document.querySelectorAll('#app :is(main, .find, .tabs):not([hidden])')].map((e) => (e as HTMLElement).innerText + ' ' + [...e.querySelectorAll('[aria-label]')].map((x) => x.getAttribute('aria-label')).join(' ')).join(' ');
      return ['제철', '작가 부부', '가고 싶어요', '담았어요'].filter((w) => t.includes(w));
    });
    expect(words, hash).toEqual([]);
  }
});

test('"작가가 다녀온 곳" 앞 회색 점은 10px 동그라미(첫 화면 줄 이름표 .rec와 겹쳐 길쭉해지던 것, 10/5 사용자)', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/find/gyegok');
  const dot = page.locator('.find-records h2 .dot');
  await dot.waitFor();
  const box = (await dot.boundingBox())!;
  expect([Math.round(box.width), Math.round(box.height)]).toEqual([10, 10]);
});
