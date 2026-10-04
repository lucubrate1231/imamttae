import { expect, test, type Page } from '@playwright/test';

/**
 * 실제 앱 첫 화면(기능 ①) — 확정 시안 v2와 같은 규칙(docs/design-guide.md, F1 완성 기준)
 * 가짜 지도(?map=fake)를 씁니다.
 */
async function open(page: Page, hash = ''): Promise<void> {
  await page.goto(`./?map=fake${hash}`);
  await page.locator('.rail .big').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test('머리 작은 글씨 "이상호 작가의 추천", 큰 제목 "N월에 만나는 풍경"', async ({ page }) => {
  await open(page, '#/month/10');
  await expect(page.locator('.eyebrow')).toHaveText('이상호 작가의 추천');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('10월에 만나는 풍경');
});

test('카드의 추천 시기 줄은 320px 폭에서도 한 줄로 끝나고 잘리지 않음(모든 달)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  const bad: string[] = [];
  for (let m = 1; m <= 12; m++) {
    await open(page, `#/month/${m}`);
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
  await open(page, '#/month/10');
  await expect(page.locator('.big .vary').first().locator('svg')).toHaveCount(1);
});

test('지도 범례는 "N월에 좋은 풍경 · 작가가 다녀온 곳"(D29·D30)', async ({ page }) => {
  await open(page, '#/month/10');
  await expect(page.locator('.legend span').first()).toHaveText('10월에 좋은 풍경');
  await expect(page.locator('.legend span.r')).toHaveText('작가가 다녀온 곳');
});

test('F1-AC9: 달을 바꾸고 뒤로 가기를 누르면 이전 달로 돌아감', async ({ page }) => {
  await open(page, '#/month/10');
  await page.getByRole('button', { name: '12월', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('12월에 만나는 풍경');
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('10월에 만나는 풍경');
  await expect(page.getByRole('button', { name: '10월', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('F1-AC12: 계절 색이 달에 따라 바뀜(4월 봄 #B0466B, 1월 겨울 #466A86)', async ({ page }) => {
  const season = () => page.$eval('#app', (el) => getComputedStyle(el).getPropertyValue('--season').trim().toLowerCase());
  await open(page, '#/month/4');
  expect(await season()).toBe('#b0466b');
  await open(page, '#/month/1');
  expect(await season()).toBe('#466a86');
});

test('F1-AC13: 아래로 스크롤해 큰 제목이 사라지면 작은 제목 막대가 나오고, 다시 올리면 사라짐', async ({ page }) => {
  await open(page, '#/month/10');
  const mini = page.locator('.mini-ttl');
  await expect(mini).not.toHaveClass(/\bon\b/);
  await page.mouse.wheel(0, 900);
  await expect(mini).toHaveClass(/\bon\b/);
  await expect(mini).toHaveText('10월에 만나는 풍경');
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(mini).not.toHaveClass(/\bon\b/);
});

test('C-1: 320px 폭에서 가로로 밀리지 않음(모든 달)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const m of [1, 5, 8, 10]) {
    await open(page, `#/month/${m}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});
