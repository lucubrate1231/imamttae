import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** 풍경 대표 사진 고르기(D44, 10/6) — 미리보기 /next/_review/covers/. 사진 그림은 시험에서 받지 않음 */
test.beforeEach(async ({ page }) => {
  await page.route(/img1\.daumcdn\.net/, (r) => r.abort());
});

test('데이터에 고른 값(typeCovers)이 있으면 처음부터 그대로 보임', async ({ page }) => {
  const data = await (await page.request.get('./data/scenes.json')).json();
  const n = Object.keys(data.typeCovers ?? {}).length;
  await page.goto('./_review/covers/');
  await expect(page.locator('#prog')).toHaveText(`13개 중 ${n}개 고름`);
  for (const [t, c] of Object.entries(data.typeCovers ?? {}) as [string, { scene: string; photo: number }][])
    await expect(page.locator(`.ph[data-t="${t}"][data-s="${c.scene}"][data-p="${c.photo}"]`)).toHaveAttribute('aria-pressed', 'true');
});

test('고르면 표시·이 브라우저에 남음 · 다른 풍경에서 고른 사진은 그 풍경 이름 · 옮기면 앞 풍경에서 빠짐 · [결과 복사]', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // 처음 한 번만 고른 값을 비움(데이터에 이미 고른 값이 있어도 흐름을 처음부터 보려고) — 새로고침 뒤에는 그대로 둠
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('test-cleared')) {
      localStorage.setItem('imamttae-covers', '{}');
      sessionStorage.setItem('test-cleared', '1');
    }
  });
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
