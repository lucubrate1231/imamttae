import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** 출시 준비 화면(D45·D46, 디자인 #107) — design-guide 12장. 폼 주소는 src/config.ts(실제 구글 폼 — 시험에서는 열지 않고 주소만 봄) */
const axe = async (page: Page, sel: string) => {
  const r = await new AxeBuilder({ page }).include(sel).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.use({ viewport: { width: 320, height: 640 } });

test('첫 화면 맨 아래: 이 앱 이야기 → 의견 보내기 카드 → 이용 안내 · 개인정보 — 누르는 곳 48 이상, 320px 넘침 없음, 접근성', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/month/10');
  const card = page.locator('main.home .extra a.feedback');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toContainText('의견 보내기');
  expect((await card.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect((await page.locator('main.home a.privacy-link').boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await axe(page, 'main.home .extra');
  await expect(card).toHaveAttribute('href', 'https://forms.gle/4viSoD1yHn9D8ixS7');
  await expect(card).toHaveAttribute('target', '_blank');
});

test('장면 상세 본문 끝 "이곳 정보가 달라졌나요?" 줄 — 높이 56 이상, 접근성', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/scene/s-020-naejangsan-uhwajeong');
  const line = page.locator('.detail.open a.fb-line');
  await line.scrollIntoViewIfNeeded();
  await expect(line).toContainText('이곳 정보가 달라졌나요?');
  expect((await line.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  const u = new URL((await line.getAttribute('href'))!);
  expect(u.origin + u.pathname).toBe('https://docs.google.com/forms/d/e/1FAIpQLSdjAaqo5JiEP8dDK-ofc0fQ93cNBI55SPXwAw-GRPK3zBiFOA/viewform');
  expect(u.searchParams.get('usp')).toBe('pp_url');
  expect(u.searchParams.get('entry.1390967997')).toBe('내장산 우화정');
  await axe(page, '.detail.open .body');
});

test('이용 안내와 개인정보: 바닥줄 → 화면(제목·구역 둘·소제목 여섯·문의) → ‹ 뒤로로 첫 화면 — 본문 18px, 제목 한 줄·고운바탕, 320px 넘침 없음, 접근성', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/month/10');
  const link = page.locator('main.home a.privacy-link');
  await link.scrollIntoViewIfNeeded();
  await link.click();
  await expect(page).toHaveURL(/#\/privacy$/);
  const p = page.locator('.privacy');
  const h1 = p.getByRole('heading', { level: 1 });
  await expect(h1).toHaveText('이용 안내와 개인정보');
  await expect(p.getByRole('heading', { level: 2 })).toHaveText(['이 앱의 정보는', '개인정보']);
  await expect(p.locator('h3.pv-h')).toHaveCount(6);
  expect(await p.locator('.pv-list li').first().evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
  // 제목은 한 줄(12-2). 명조로 그렸는지는 fonts.spec
  const lh = await h1.evaluate((e) => parseFloat(getComputedStyle(e).lineHeight) || parseFloat(getComputedStyle(e).fontSize) * 1.5);
  expect((await h1.boundingBox())!.height).toBeLessThan(lh * 1.6);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await axe(page, '.privacy');
  await p.getByRole('button', { name: '뒤로' }).click();
  await expect(page).toHaveURL(/#\/month\/10$/);
  await expect(page.locator('main.home')).toBeVisible();
});

test('저장한 곳: 상자 끝 "개인정보 안내 보기 ›"(누르면 개인정보 구역이 맨 위), 설치 카드 아래 의견 보내기 카드', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/saved');
  const more = page.locator('.saved .sv-note a.privacy-more');
  await expect(more).toHaveText('개인정보 안내 보기 ›');
  await more.click();
  await expect(page).toHaveURL(/#\/privacy\/personal$/);
  await expect.poll(async () => Math.round((await page.locator('#pv-personal').boundingBox())!.y)).toBeLessThanOrEqual(12);
  await page.goBack();
  await expect(page.locator('.saved .sv-foot a.feedback')).toBeVisible();
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await axe(page, '.saved .sv-foot');
});
