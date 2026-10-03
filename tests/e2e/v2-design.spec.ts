import { expect, test, type Page } from '@playwright/test';

/**
 * 시안 v2(첫 화면·장면 상세)의 디자인 규칙 — docs/design-guide.md
 * 카카오 지도는 막아 둡니다(키 없이도 화면은 떠야 함).
 */
async function open(page: Page, query = ''): Promise<void> {
  await page.route('**/dapi.kakao.com/**', (r) => r.abort());
  await page.goto(`./_review/v2.html${query}`);
  await page.locator('.big').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test('머리 작은 글씨는 "이상호 작가의 추천"', async ({ page }) => {
  await open(page);
  await expect(page.locator('.eyebrow')).toHaveText('이상호 작가의 추천');
});

test('카드의 추천 시기 줄은 320px 폭에서도 한 줄로 끝나고 잘리지 않음(모든 달)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.route('**/dapi.kakao.com/**', (r) => r.abort());
  const bad: string[] = [];
  for (let m = 1; m <= 12; m++) {
    await page.goto(`./_review/v2.html?m=${m}`);
    await page.evaluate(() => document.fonts.ready);
    const rows = await page.$$eval('.big .best', (els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        const inner = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const parts = [el, ...el.querySelectorAll('strong')];
        return { t: el.textContent ?? '', lines: Math.round(inner / lh), cut: parts.some((p) => p.scrollWidth > p.clientWidth) };
      }),
    );
    for (const r of rows) if (r.lines > 1 || r.cut) bad.push(`${m}월 "${r.t}" 줄 ${r.lines}${r.cut ? ', 잘림' : ''}`);
  }
  expect(bad).toEqual([]);
});

test('카드의 참고사항(해마다 달라져요 등) 앞에 작은 안내 아이콘', async ({ page }) => {
  await open(page, '?m=10');
  const vary = page.locator('.big .vary').first();
  await expect(vary.locator('svg')).toHaveCount(1);
});

test('장면 상세는 옆으로 밀리지 않음(가로 넘침 없음)', async ({ page }) => {
  await open(page, '?m=10');
  await page.locator('.big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  const over = await page.$eval('.detail', (d) => d.scrollWidth - d.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});

test('사진 위 버튼은 상세에 들어갈 때 바로 뜨지 않고, 1초쯤 뒤 서서히 나타남', async ({ page }) => {
  await open(page, '?m=10');
  // 앞 장면 상세를 아래로 내렸다가 돌아온 뒤 다른 장면을 열어도(스크롤 위치를 되돌릴 때) 바로 뜨면 안 됨
  await page.locator('.big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.$eval('.detail', (d) => d.scrollTo(0, 600));
  await page.goBack();
  await expect(page.locator('.detail.open')).toHaveCount(0);
  await page.locator('.big').nth(1).click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await expect(page.locator('.gallery')).toHaveClass(/ov-wait/);
  await page.waitForTimeout(400);
  await expect(page.locator('.gallery')).toHaveClass(/ov-wait/);
  await expect(page.locator('.gallery')).not.toHaveClass(/ov-wait/, { timeout: 4500 });
});
