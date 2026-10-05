import { expect, test } from '@playwright/test';

/**
 * 좌표 확인 페이지 — 미리보기에 올린 판(/next/_review/places/, 10/5 콘텐츠 세션에서 이어서 하려고)
 * 바깥 지도 그림(오픈스트리트맵)은 시험에서 받지 않음 — 페이지 흐름만 봄
 */
test.beforeEach(async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org/, (r) => r.abort());
});

test('지금까지 확인한 값이 들어 있고, 후보를 골라 저장하면 이 브라우저에 남고, [결과 복사]에 담김', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./_review/places/');
  const prog = page.locator('#prog');
  await expect(prog).toHaveText(/^확인 \d+ \/ \d+곳$/); // 전체 수는 숨긴 장면에 따라 바뀜(10/5 육백마지기 숨김 → 92)
  const [, b, all] = (await prog.textContent())!.match(/확인 (\d+) \/ (\d+)곳/)!;
  const before = Number(b);
  expect(before).toBeGreaterThanOrEqual(50); // 10/5 사용자가 확인한 값(tools/places/picked-seed.json)
  await expect(page.locator('#share')).toBeVisible();

  // 아직 안 한 곳 하나: 관광정보 후보로 장면 위치, 지도에서 찍기 대신 목적지 이름과 함께 후보 주차장(없으면 장면 위치를 목적지로)
  await page.locator('.item', { hasText: '남음' }).first().click();
  await page.locator('#useSpot').click();
  const park = page.locator('#panel [data-k]').first();
  if (await park.count()) await park.click();
  else {
    await page.locator('#modeDest').click();
    await page.locator('#map').click({ position: { x: 200, y: 150 } });
  }
  await page.locator('#destName').fill('시험 주차장');
  await page.locator('#save').click();
  await expect(page.locator('#savemsg')).toHaveText('이 브라우저에 저장했어요');
  await expect(prog).toHaveText(`확인 ${before + 1} / ${all}곳`);

  await page.reload();
  await expect(prog).toHaveText(`확인 ${before + 1} / ${all}곳`);

  await page.locator('#copy').click();
  await expect(page.locator('#copymsg')).toHaveText(`${before + 1}곳 복사했어요`);
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied.format).toBe('imamttae-places/1');
  expect(Object.values(copied.picked).some((v) => (v as { dest?: { name?: string } }).dest?.name === '시험 주차장')).toBe(true);
});

test('휴대폰 폭에서 가로로 밀리지 않음(목록 → 지도 → 정하기 칸)', async ({ page }) => {
  await page.goto('./_review/places/');
  await expect(page.locator('#prog')).toHaveText(/곳$/);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});
