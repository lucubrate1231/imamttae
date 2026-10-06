import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** 풍경 대표 사진 고르기(D44, 10/6) — 미리보기 /next/_review/covers/. 사진 그림은 시험에서 받지 않음 */
test.beforeEach(async ({ page }) => {
  await page.route(/img1\.daumcdn\.net/, (r) => r.abort());
});

test('고르면 표시·이 브라우저에 남음 · 다른 풍경에서 고른 사진은 그 풍경 이름 · 옮기면 앞 풍경에서 빠짐 · [결과 복사]', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./_review/covers/');
  await expect(page.locator('#prog')).toHaveText('13개 중 0개 고름');
  // 여름꽃과 바다 절경에 함께 든 장면의 사진(강진 가우도처럼)을 찾아 여름꽃 대표로
  const shared = await page.evaluate(() => {
    const ids = (t: string) => [...document.querySelectorAll<HTMLElement>(`.ph[data-t="${t}"]`)].map((b) => `${b.dataset.s}|${b.dataset.p}`);
    const bada = new Set(ids('bada'));
    return ids('yeoreumkkot').find((x) => bada.has(x))!;
  });
  const [s, p] = shared.split('|');
  const inType = (t: string) => page.locator(`.ph[data-t="${t}"][data-s="${s}"][data-p="${p}"]`);
  await inType('yeoreumkkot').click();
  await expect(inType('yeoreumkkot')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#prog')).toHaveText('13개 중 1개 고름');
  await expect(inType('bada').locator('.tag')).toHaveText(/대표$/); // 바다 절경 쪽에는 '여름꽃 대표'
  // 바다 절경으로 옮기면 여름꽃에서 빠짐
  await inType('bada').click();
  await expect(inType('bada')).toHaveAttribute('aria-pressed', 'true');
  await expect(inType('yeoreumkkot')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#t-bada .moved')).toContainText('옮겼어요');
  await page.reload();
  await expect(page.locator('#prog')).toHaveText('13개 중 1개 고름');
  await page.locator('#copy').click();
  await expect(page.locator('#copymsg')).toHaveText('1개 복사했어요');
  const copied = JSON.parse(await page.evaluate(() => navigator.clipboard.readText()));
  expect(copied).toMatchObject({ format: 'imamttae-covers/1', covers: { bada: { scene: s, photo: Number(p) } } });
});

test('휴대폰 폭에서 가로로 안 밀리고 접근성 위반 0', async ({ page }) => {
  await page.goto('./_review/covers/');
  await expect(page.locator('#prog')).toHaveText(/고름$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const a = await new AxeBuilder({ page }).analyze();
  expect(a.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
