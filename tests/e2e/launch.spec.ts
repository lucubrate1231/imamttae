import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** 출시 준비 화면(D45·D46, 디자인 #107) — design-guide 12장. 폼 주소가 아직 없어(src/config.ts) 누르면 '곧 열려요' */
const axe = async (page: Page, sel: string) => {
  const r = await new AxeBuilder({ page }).include(sel).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.use({ viewport: { width: 320, height: 640 } });

test('첫 화면 맨 아래: 이 앱 이야기 → 의견 보내기 카드 → 개인정보 안내 — 누르는 곳 48 이상, 320px 넘침 없음, 접근성', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/month/10');
  const card = page.locator('main.home .extra a.feedback');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText('의견 보내기');
  expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect((await page.locator('main.home a.privacy-link').boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await axe(page, 'main.home .extra');
  await card.click();
  await expect(page.locator('.toast')).toHaveText('의견 보내기는 곧 열려요');
});

test('장면 상세 본문 끝 "이곳 정보가 달라졌나요?" 줄 — 높이 56 이상, 접근성', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/scene/s-020-naejangsan-uhwajeong');
  const line = page.locator('.detail.open a.fb-line');
  await line.scrollIntoViewIfNeeded();
  await expect(line).toContainText('이곳 정보가 달라졌나요?');
  expect((await line.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await axe(page, '.detail.open .body');
});

test('개인정보 안내: 바닥줄 → 화면(제목·소제목 다섯·문의) → ‹ 뒤로로 첫 화면 — 본문 18px, 320px 넘침 없음, 접근성', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/month/10');
  const link = page.locator('main.home a.privacy-link');
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page).toHaveURL(/#\/privacy$/);
  const p = page.locator('.privacy');
  await expect(p.getByRole('heading', { level: 1 })).toHaveText('개인정보 안내');
  await expect(p.locator('h2.pv-h')).toHaveCount(5);
  expect(await p.locator('.pv-body').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await axe(page, '.privacy');
  await p.getByRole('button', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/#\/month\/10$/);
  await expect(page.locator('main.home')).toBeVisible();
});

test('저장한 곳: 상자 끝 "개인정보 안내 보기 ›", 설치 카드 아래 의견 보내기 카드', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/saved');
  await expect(page.locator('.saved .sv-note a.privacy-more')).toHaveText('개인정보 안내 보기 ›');
  await expect(page.locator('.saved .sv-foot a.feedback')).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await axe(page, '.saved .sv-foot');
});
