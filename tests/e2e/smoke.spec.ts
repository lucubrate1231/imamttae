import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('첫 화면: 앱 이름, 이번 달 선택, 오류 없음', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('./?map=fake');
  await expect(page.getByRole('heading', { name: '이맘때 자연' })).toBeVisible();
  await expect(page.locator('.mchip[aria-pressed="true"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('달을 누르면 주소가 바뀌고, 그 주소로 다시 열어도 같은 달', async ({ page }) => {
  await page.goto('./?map=fake');
  await page.getByRole('button', { name: '12월' }).click();
  await expect(page).toHaveURL(/#\/month\/12$/);
  await page.reload();
  await expect(page.getByRole('button', { name: '12월' })).toHaveAttribute('aria-pressed', 'true');
});

test('가로 스크롤 없음(320px 폭)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('./?map=fake');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('누르는 곳은 48px 이상', async ({ page }) => {
  await page.goto('./?map=fake');
  const small = await page.$$eval('button, a', (els) =>
    els
      .filter((e) => (e as HTMLElement).offsetParent !== null && !e.closest('.foot'))
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height < 48 || r.width < 48)
      .length,
  );
  expect(small).toBe(0);
});

test('접근성 검사(axe) 위반 0', async ({ page }) => {
  await page.goto('./?map=fake');
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('검색엔진 노출 막음(noindex)', async ({ page }) => {
  await page.goto('./?map=fake');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('실제 앱 첫 화면도 시안과 같은 디자인 토큰을 씀(기본 계절색 가을, 제목 글꼴 고운바탕)', async ({ page }) => {
  await page.goto('./?map=fake');
  const t = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return { season: cs.getPropertyValue('--season').trim().toLowerCase(), display: cs.getPropertyValue('--font-display'), body: cs.getPropertyValue('--font-body') };
  });
  expect(t.season).toBe('#b0502a');
  expect(t.display).toContain('Gowun Batang');
  expect(t.body).toContain('IBM Plex Sans KR');
});
