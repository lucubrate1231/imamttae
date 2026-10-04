import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** 저장한 곳(F4) 사용 흐름 — 가짜 지도(?map=fake). 다녀온 곳(도장)은 다음 PR([다녀왔어요])에서 흐름으로 확인 */
async function open(page: Page, hash = '#/saved'): Promise<void> {
  await page.goto(`./?map=fake&motion=0${hash}`);
  await page.locator('#app > :not([hidden]):is(main, .find, .saved)').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

/** 장면 상세를 열어 [저장]을 누르고 닫음 */
async function save(page: Page, id: string): Promise<void> {
  await open(page, `#/scene/${id}`);
  await expect(page.locator('.detail.open')).toBeVisible();
  const btn = page.locator('.detail .dact[aria-pressed]');
  await btn.click();
  await expect(btn).toHaveAttribute('aria-pressed', 'true');
}

test('F4-AC1: 아래 메뉴 "저장한 곳" → 저장한 곳 탭(가고 싶은 곳 → 다녀온 곳 → 안내), 메뉴는 320px에서도 한 줄', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page, '#/month/10');
  await page.getByRole('button', { name: '저장한 곳', exact: true }).click();
  await expect(page).toHaveURL(/#\/saved$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('저장한 곳');
  await expect(page.locator('.saved h2')).toHaveText(['가고 싶은 곳', '다녀온 곳']);
  await expect(page.locator('.saved .sv-note')).toContainText('이 휴대폰에만 저장돼요');
  const tops = await page.$$eval('.tabs button', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  const lines = await page.$$eval('.tabs button', (bs) => bs.map((b) => b.getClientRects().length));
  expect(lines.every((n) => n === 1)).toBe(true);
});

test('F4-AC11: 처음에는 빈 안내 + [지금 풍경 보러 가기] → 첫 화면', async ({ page }) => {
  await open(page);
  await expect(page.locator('.sv-wish-empty')).toContainText("장면에서 '저장'을 누르면");
  await expect(page.locator('.sv-visit-empty')).toContainText('[다녀왔어요]');
  await page.getByRole('button', { name: '지금 풍경 보러 가기' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /월에 만나는 풍경/ })).toBeVisible();
});

test('F4-AC3·AC2: [저장] → 안내 줄의 [보기 ›] → 저장한 곳에 그 줄, 줄을 누르면 상세 → 뒤로 오면 저장한 곳 그대로', async ({ page }) => {
  await save(page, 's-020-naejangsan-uhwajeong');
  await expect(page.locator('.toast')).toContainText("저장했어요 · '저장한 곳'에서 볼 수 있어요");
  await page.locator('.toast .toast-go').click();
  await expect(page).toHaveURL(/#\/saved$/);
  const row = page.locator('.sv-wish').first();
  await expect(row.locator('.sv-name')).toHaveText('내장산 우화정');
  await expect(row.getByRole('button', { name: '길찾기' })).toBeVisible();
  await row.locator('.sv-wtop').click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.locator('.detail .back').click();
  await expect(page.locator('.detail.open')).toHaveCount(0);
  await expect(page).toHaveURL(/#\/saved$/);
  await expect(page.locator('.sv-wish .sv-name')).toHaveText(['내장산 우화정']);
});

test('F4-AC14: 새로고침해도 가고 싶은 곳이 남고, [빼기]로 빼면 빈 안내로', async ({ page }) => {
  await save(page, 's-005-biryong');
  await open(page);
  await page.reload();
  await page.locator('.saved:not([hidden])').waitFor();
  await expect(page.locator('.sv-wish .sv-name')).toHaveText(['설악산 비룡폭포']);
  await page.getByRole('button', { name: '빼기' }).click();
  await expect(page.locator('.toast')).toContainText('저장한 곳에서 뺐어요');
  await expect(page.locator('.sv-wish-empty')).toBeVisible();
  await page.reload();
  await expect(page.locator('.sv-wish-empty')).toBeVisible();
});

test('F4-AC16: 저장이 막힌 브라우저에서는 탭 맨 위에 "이 브라우저에서는 저장되지 않아요", 화면은 그대로', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('막힘', 'QuotaExceededError');
    };
  });
  await save(page, 's-005-biryong');
  await page.locator('.detail .back').click();
  await page.getByRole('button', { name: '저장한 곳', exact: true }).click();
  await expect(page.locator('.sv-warn')).toHaveText('이 브라우저에서는 저장되지 않아요.');
  await expect(page.locator('.sv-wish .sv-name')).toHaveText(['설악산 비룡폭포']); // 메모리에서는 작동
});

test('C-1·C-2: 320px 폭에서 가로로 밀리지 않고, 누르는 곳은 48px 이상', async ({ page }) => {
  await save(page, 's-020-naejangsan-uhwajeong');
  await save(page, 's-006-baekgil-beach');
  await save(page, 's-022-gwangyang-maehwa');
  await page.setViewportSize({ width: 320, height: 640 });
  await open(page);
  await expect(page.locator('.sv-wish')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const small = await page.$$eval('.saved button, .saved a, .tabs button', (els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 12), r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 48 || r.width < 48)
      .map(({ t, r }) => `${t} ${Math.round(r.width)}x${Math.round(r.height)}`),
  );
  expect(small).toEqual([]);
});

test('C-3: 저장한 곳 접근성 검사(axe) 위반 0 — 빈 화면과 줄이 있는 화면', async ({ page }) => {
  await open(page);
  let r = await new AxeBuilder({ page }).include('.saved').analyze();
  expect(r.violations.map((v) => `빈 화면 ${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  await save(page, 's-020-naejangsan-uhwajeong');
  await save(page, 's-006-baekgil-beach');
  await open(page);
  r = await new AxeBuilder({ page }).include('.saved').analyze();
  expect(r.violations.map((v) => `줄 ${v.id}: ${v.help}`)).toEqual([]);
});

test('#/stamps 옛 주소도 저장한 곳으로 열림', async ({ page }) => {
  await open(page, '#/stamps');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('저장한 곳');
});
