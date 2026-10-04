import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// 크롬의 처음 [저장] 판(F5-AC6)은 이미 본 것으로 — 여기서는 저장 뒤 흐름을 봄(판은 a2hs.spec.ts)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('imamttae:a2hs', JSON.stringify({ sheetShown: true })));
});

/** 제철 알림 카드(F4-AC10) — 오늘을 2026년 10월 4일(한국)로 고정. 내장산 우화정(10~11월)·설악산 비룡폭포(10월)가 지금 좋음 */
const NOW = new Date('2026-10-04T03:00:00Z');

async function save(page: Page, id: string): Promise<void> {
  await page.goto(`./?map=fake&motion=0#/scene/${id}`);
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.locator('.detail .dact[aria-pressed]').click();
}
async function home(page: Page): Promise<void> {
  await page.goto('./?map=fake&motion=0#/');
  await page.locator('#app main.home:not([hidden])').waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test('F4-AC10: 한 곳이면 "저장하신 내장산 우화정, 지금 가기 좋아요" → 누르면 그 장면', async ({ page }) => {
  await save(page, 's-020-naejangsan-uhwajeong');
  await home(page);
  const card = page.locator('main.home .acard');
  await expect(card.locator('.ac-msg')).toHaveText('저장하신 내장산 우화정, 지금 가기 좋아요');
  await card.locator('.ac-go').click();
  await expect(page).toHaveURL(/#\/scene\/s-020-naejangsan-uhwajeong$/);
  await expect(page.locator('.detail.open .title')).toHaveText('내장산 우화정');
});

test('F4-AC10: 여러 곳이면 "저장하신 2곳이 …" + "○○ 외 1곳" → 저장한 곳 탭(맨 위에도 같은 카드)', async ({ page }) => {
  await save(page, 's-020-naejangsan-uhwajeong');
  await save(page, 's-005-biryong');
  await home(page);
  await expect(page.locator('main.home .acard .ac-msg')).toHaveText('저장하신 2곳이 지금 가기 좋아요');
  await expect(page.locator('main.home .acard .ac-sub')).toHaveText('설악산 비룡폭포 외 1곳'); // 10월에 끝나는 곳이 앞
  await page.locator('main.home .acard .ac-go').click();
  await expect(page).toHaveURL(/#\/saved$/);
  await expect(page.locator('.sv-head .acard .ac-msg')).toHaveText('저장하신 2곳이 지금 가기 좋아요');
});

test('F4-AC10: [×]로 닫으면 첫 화면·저장한 곳 모두 사라지고, 새로고침해도 그달에는 다시 뜨지 않음', async ({ page }) => {
  await save(page, 's-005-biryong');
  await home(page);
  await page.getByRole('button', { name: '알림 닫기' }).click();
  await expect(page.locator('.acard')).toHaveCount(0);
  await page.reload();
  await page.locator('#app main.home:not([hidden])').waitFor();
  await expect(page.locator('.acard')).toHaveCount(0);
  await page.getByRole('button', { name: '저장한 곳', exact: true }).click();
  await expect(page.locator('.sv-wish')).toHaveCount(1);
  await expect(page.locator('.acard')).toHaveCount(0);
});

test('C-1·C-2·C-3: 320px에서 넘치지 않고, 누르는 곳 48px 이상, 접근성(axe) 위반 0', async ({ page }) => {
  await save(page, 's-020-naejangsan-uhwajeong');
  await save(page, 's-005-biryong');
  await page.setViewportSize({ width: 320, height: 640 });
  for (const [hash, sel] of [['#/', 'main.home .acard'], ['#/saved', '.sv-head .acard']] as const) {
    await page.goto(`./?map=fake&motion=0${hash}`);
    const card = page.locator(sel);
    await expect(card).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), hash).toBeLessThanOrEqual(0);
    const box = await card.boundingBox();
    expect(box!.x + box!.width, hash).toBeLessThanOrEqual(320);
    const small = await card.locator('button').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect()).filter((r) => r.height < 48 || r.width < 48).length);
    expect(small, hash).toBe(0);
    const r = await new AxeBuilder({ page }).include(sel).analyze();
    expect(r.violations.map((v) => `${hash} ${v.id}: ${v.help}`)).toEqual([]);
  }
});
