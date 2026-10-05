import { expect, test, type Page } from '@playwright/test';

/**
 * 2단계 사용성 테스트 과제 세 가지(10/5 기획 — 옛 '도장 찍기' 대신)를 처음부터 끝까지 따라가 봅니다.
 * 사람이 하는 테스트 전에 이 흐름이 막히지 않는지 지킵니다. 가짜 지도(?map=fake), 안드로이드 휴대폰.
 */
test.beforeEach(async ({ page }) => {
  // 크롬의 처음 [저장] 판(F5-AC6)은 이미 본 것으로(판은 a2hs.spec.ts)
  await page.addInitScript(() => localStorage.setItem('imamttae:a2hs', JSON.stringify({ sheetShown: true })));
});

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`./?map=fake&motion=0${hash}`);
  await page.locator('#app > :not([hidden]):is(main, .find, .saved)').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test('과제 ①: 이번 달 풍경 하나를 골라 길찾기 열기', async ({ page }) => {
  await page.route('https://map.kakao.com/**', (r) => r.fulfill({ contentType: 'text/html', body: '<title>카카오맵</title>' }));
  await open(page, '#/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/월에 만나는 풍경$/);
  const card = page.locator('.rail .big').first();
  await card.click();
  const detail = page.locator('.detail.open');
  await expect(detail).toBeVisible();
  const name = (await detail.locator('h1, h2').first().textContent())!.trim();
  // 기본 앱(티맵)이 없는 휴대폰 → 다른 앱 안내 → 카카오맵으로 길찾기가 열림(이름이 아니라 좌표로)
  await detail.locator('.go').click();
  const sheet = page.locator('.navi-sheet');
  await expect(sheet).toBeVisible({ timeout: 4000 });
  const [req] = await Promise.all([page.waitForRequest(/map\.kakao\.com\/link\/to\//), sheet.getByRole('button', { name: '카카오맵' }).click()]);
  const to = decodeURIComponent(new URL(req.url()).pathname.replace('/link/to/', ''));
  expect(to).toMatch(/,3\d\.\d+,12\d\.\d+$/);
  expect(name.length).toBeGreaterThan(0);
});

test('과제 ②: 단풍을 언제·어디서 볼 수 있는지 찾기', async ({ page }) => {
  await open(page, '#/month/10');
  await page.getByRole('button', { name: '풍경 찾기', exact: true }).click();
  await expect(page).toHaveURL(/#\/find$/);
  await page.locator('button.tile', { has: page.locator('.tile-name', { hasText: /^단풍/ }) }).first().click();
  await expect(page).toHaveURL(/#\/find\/danpung$/);
  // 언제: 결과 머리에 '…월' 시기 줄
  await expect(page.locator('.find-head.result h1')).toHaveText(/^단풍/);
  await expect(page.locator('.find-head.result .when-line')).toContainText('월');
  // 어디서: 장소 줄마다 지역, 지도에 점
  const rows = page.locator('.find-list .row');
  expect(await rows.count()).toBeGreaterThan(0);
  await expect(rows.first().locator('.row-meta')).not.toBeEmpty();
  expect(await page.locator('.find [data-pin-id]').count()).toBeGreaterThan(0);
  // 한 곳을 열면 추천 시기
  await rows.first().click();
  await expect(page.locator('.detail.open')).toContainText('추천 시기');
});

test('과제 ③: 저장한 곳에서 장소를 골라 [다녀왔어요] → 도장', async ({ page }) => {
  const ID = 's-020-naejangsan-uhwajeong';
  const NAME = '내장산 우화정';
  // 준비: 장면 하나를 저장해 둠
  await open(page, `#/scene/${ID}`);
  const save = page.locator('.detail .dact[aria-pressed]');
  await save.click();
  await expect(save).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.detail .back').click();
  // 과제: 아래 메뉴 '저장한 곳' → 장소 고르기 → [다녀왔어요] → 도장
  await page.getByRole('button', { name: '저장한 곳', exact: true }).click();
  await expect(page).toHaveURL(/#\/saved$/);
  const row = page.locator('.sv-wish', { has: page.locator('.sv-name', { hasText: NAME }) });
  await row.locator('.sv-wtop').click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.locator('.detail .vbox-go').click();
  const stamp = page.getByRole('dialog', { name: '도장을 찍었어요' });
  await expect(stamp.locator('.sm-ttl')).toHaveText(`${NAME}에 다녀왔어요`);
  await stamp.getByRole('button', { name: '확인' }).click();
  await page.locator('.detail .back').click();
  await expect(page).toHaveURL(/#\/saved$/);
  await expect(page.locator('.saved .sv-stamp b')).toHaveText([NAME]);
});
