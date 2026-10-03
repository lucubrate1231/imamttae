import { expect, test } from '@playwright/test';

/** 사용 통계 — 내 컴퓨터·화면 테스트에서는 아무것도 보내지 않고, 통계가 앱을 멈추게 하지 않음(docs/analytics.md) */
test('내 컴퓨터(localhost)에서는 Umami로 아무 요청도 나가지 않음', async ({ page }) => {
  const umami: string[] = [];
  page.on('request', (r) => r.url().includes('umami') && umami.push(r.url()));
  await page.goto('./?map=fake#/month/10');
  await page.locator('.rail .big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.waitForTimeout(500);
  expect(umami).toEqual([]);
});

test('우리 식구 빼기: ?me=off 로 열면 알리고, 주소에서 me를 지움(# 뒤는 그대로)', async ({ page }) => {
  await page.goto('./?map=fake&me=off#/month/10');
  await expect(page.locator('.toast')).toHaveText('이 브라우저는 통계에서 빠졌어요');
  expect(await page.evaluate(() => localStorage.getItem('umami.disabled'))).toBe('1');
  await expect(page).toHaveURL(/\?map=fake#\/month\/10$/);
});

test('공유 주소에는 ?from=share 만 붙음(복사로 확인)', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }));
  await page.goto('./?map=fake&utm_source=band#/month/10');
  await page.locator('.rail .big').first().click();
  await page.locator('.detail .dact', { hasText: '공유' }).click();
  await expect(page.locator('.toast')).toHaveText('주소를 복사했어요');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(/\/\?from=share#\/scene\/[a-z0-9-]+$/);
});
