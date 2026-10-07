import { expect, test } from '@playwright/test';

/** 장면별 카톡 미리보기(D63) — 공유 페이지 s/<번호>/ */
test('공유 페이지: 그 장면의 카드 정보(og)가 있고, 열면 바로 앱의 그 장면으로(?from=share 그대로)', async ({ page }) => {
  const id = 's-013-daeseung-falls';
  const html = await (await page.request.get(`./s/${id}/`)).text();
  expect(html).toContain('<meta property="og:title" content="설악 대승폭포 단풍길 — 이맘때 풍경" />');
  expect(html).toContain('<meta property="og:description" content="강원 인제 · 작가가 아내와 다녀온 곳" />');
  expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  await page.goto(`./s/${id}/?from=share&map=fake`);
  await expect(page).toHaveURL(new RegExp(`/\?from=share&map=fake#/scene/${id}$`));
  await expect(page.locator('.detail.open .title')).toHaveText('설악 대승폭포 단풍길');
});

test('장면 상세 [공유]가 보내는 주소는 공유 페이지, 그 주소를 열면 같은 장면', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => Object.defineProperty(navigator, 'share', { value: undefined }));
  await page.goto('./?map=fake&motion=0#/scene/s-013-daeseung-falls');
  await page.locator('.detail .dact', { hasText: '공유' }).click();
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/\/s\/s-013-daeseung-falls\/\?from=share$/);
  await page.goto(url.replace('?from=share', '?from=share&map=fake'));
  await expect(page.locator('.detail.open .title')).toHaveText('설악 대승폭포 단풍길');
});
