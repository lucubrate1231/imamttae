import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * 실제 앱 장면 상세(F2) — 확정 시안 v2의 상세 규칙(docs/design-guide.md 6장) + 10/4 결정
 * 가짜 지도(?map=fake)를 씁니다.
 */
async function home(page: Page, hash = '#/month/10', query = ''): Promise<void> {
  await page.goto(`./?map=fake${query}${hash}`);
  await page.locator('.rail .big').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function openFirst(page: Page, query = ''): Promise<void> {
  await home(page, '#/month/10', query);
  await page.locator('.rail .big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
}

test('F2-AC1: 카드를 누르면 상세가 열리고(#/scene/…), 뒤로 버튼으로 보던 달의 첫 화면에 돌아옴', async ({ page }) => {
  await home(page, '#/month/8');
  await page.locator('.rail .big').first().click();
  await expect(page).toHaveURL(/#\/scene\//);
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.locator('.detail .back').click(); // 사진 위 버튼이 나타날 때까지 기다렸다 누름(사람처럼)
  await expect(page.locator('.detail.open')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('8월에 만나는 풍경');
});

test('F2-AC1: 상세 주소를 바로 열어도 뜨고, 휴대폰 뒤로 가기로 닫힘', async ({ page }) => {
  await home(page);
  await page.locator('.rail .big').first().click();
  const url = page.url();
  await page.goto('about:blank');
  await page.goto(url);
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.goBack();
  await page.goForward();
  await expect(page.locator('.detail.open')).toBeVisible();
});

test('구역 순서: 제목 → 추천 시기 → 작가의 한마디 → 브런치 전체 이야기', async ({ page }) => {
  await openFirst(page);
  const order = await page.$$eval('.detail .body > .dsec', (els) => els.map((e) => e.getAttribute('aria-label')));
  expect(order).toEqual(['제목', '추천 시기', '작가의 한마디', '브런치 전체 이야기']);
});

test('장면 상세는 옆으로 밀리지 않음(가로 넘침 없음)', async ({ page }) => {
  await openFirst(page);
  const over = await page.$eval('.detail', (d) => d.scrollWidth - d.clientWidth);
  expect(over).toBeLessThanOrEqual(0);
});

test('사진 위 버튼은 상세에 들어갈 때 바로 뜨지 않고, 1초쯤 뒤 서서히 나타남', async ({ page }) => {
  await openFirst(page);
  await page.$eval('.detail', (d) => d.scrollTo(0, 600));
  await page.goBack();
  await expect(page.locator('.detail.open')).toHaveCount(0);
  await page.locator('.rail .big').nth(1).click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await expect(page.locator('.gallery')).toHaveClass(/ov-wait/);
  await page.waitForTimeout(400);
  await expect(page.locator('.gallery')).toHaveClass(/ov-wait/);
  await expect(page.locator('.gallery')).not.toHaveClass(/ov-wait/, { timeout: 4500 });
});

test('넘김 화살표로 다음 사진에 가면 버튼이 숨었다가 약 0.5초 안에 다시 다 보임', async ({ page }) => {
  await openFirst(page);
  const gallery = page.locator('.gallery');
  await expect(gallery).not.toHaveClass(/ov-wait/, { timeout: 4500 });
  const t = await page.evaluate(
    () =>
      new Promise<{ hidden: boolean; back: number }>((res) => {
        const g = document.querySelector('.gallery')!;
        const t0 = performance.now();
        (document.querySelector('.gallery .next') as HTMLButtonElement).click();
        const hidden = g.classList.contains('ov-wait');
        const iv = setInterval(() => {
          if (!g.classList.contains('ov-wait')) {
            clearInterval(iv);
            res({ hidden, back: performance.now() - t0 });
          }
        }, 10);
      }),
  );
  expect(t.hidden).toBe(true);
  const fade = await page.$eval('.gallery .back', (b) => parseFloat(getComputedStyle(b).transitionDuration));
  expect(t.back).toBeGreaterThan(150);
  expect(t.back + fade * 1000).toBeLessThanOrEqual(560);
  await expect(page.locator('.gdots i').nth(1)).toHaveClass(/on/);
});

test('추천 시기 칸의 안내 글은 내어쓰기 없이 "올해 ○○ 찾아보기"와 왼쪽이 맞음', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await openFirst(page);
  const r = await page.evaluate(() => {
    const vary = document.querySelector('.when-vary')!;
    const range = document.createRange();
    range.selectNodeContents(vary);
    const lines = [...range.getClientRects()].filter((x) => x.width > 4);
    const last = lines[lines.length - 1]!;
    const link = document.querySelector('.when-link')!.getBoundingClientRect();
    const row = document.querySelector('.when-row')!.getBoundingClientRect();
    return { lastLeft: Math.round(last.left), linkLeft: Math.round(link.left), rowLeft: Math.round(row.left), multi: new Set(lines.map((x) => Math.round(x.top))).size > 1 };
  });
  expect(r.multi).toBe(true);
  expect(Math.abs(r.lastLeft - r.linkLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.linkLeft - r.rowLeft)).toBeLessThanOrEqual(1);
});

test('올해 소식 찾아보기: 단풍 장면은 "올해 + 단풍지도"로 검색', async ({ page }) => {
  await openFirst(page);
  const link = page.locator('.when-link');
  await expect(link).toHaveText('올해 단풍지도 찾아보기 ›');
  const q = new URL((await link.getAttribute('href'))!).searchParams.get('query');
  expect(q).toBe(`${new Date().getFullYear()} 단풍지도`);
});

test('사진 안내는 모든 장면에("사진은 작가가 …"), 화면에 "제철"·"작가 부부"라는 말이 없음(D29·D30)', async ({ page }) => {
  await home(page, '#/month/8');
  await page.locator('.rec').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await expect(page.locator('.detail')).not.toContainText('제철');
  await expect(page.locator('.detail')).not.toContainText('작가 부부');
  await expect(page.locator('.detail .recnote')).toContainText('사진은 작가가');
  await page.goBack();
  await page.locator('.rail .big').first().click();
  await expect(page.locator('.detail .recnote')).toContainText('사진은 작가가');
});

const kbState = (page: Page) => page.$$eval('.gallery .kb', (els) => els.map((e) => e.getAnimations().some((a) => a.playState === 'running')));

test('사진 움직임(기본): 지금 사진만 아주 천천히(10초 넘게) 움직이고, 넘기면 새 사진이 처음부터', async ({ page }) => {
  await openFirst(page);
  await expect.poll(async () => (await kbState(page))[0]).toBe(true);
  expect((await kbState(page)).slice(1).every((x) => !x)).toBe(true);
  const dur = await page.$eval('.gallery .kb', (e) => parseFloat(getComputedStyle(e).animationDuration));
  expect(dur).toBeGreaterThanOrEqual(10);
  await page.locator('.gallery .next').click();
  await expect.poll(async () => (await kbState(page)).slice(0, 2), { timeout: 3000 }).toEqual([false, true]);
});

test('사진 움직임: 주소에 ?motion=0 을 붙이면 움직이지 않음', async ({ page }) => {
  await openFirst(page, '&motion=0');
  await expect(page.locator('.gallery .kb')).toHaveCount(0);
});

test('사진 움직임: 휴대폰에서 "동작 줄이기"를 켜면 움직이지 않음', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFirst(page);
  await page.waitForTimeout(1500);
  expect((await kbState(page)).some((x) => x)).toBe(false);
});

test('길찾기: 버튼 "길찾기(티맵)", 티맵이 없는 휴대폰이면 "티맵 설치 / 네이버지도 / 카카오맵" 안내', async ({ page }) => {
  await openFirst(page);
  const go = page.locator('.detail .go');
  await expect(go).toHaveText('길찾기(티맵)');
  await go.click();
  const sheet = page.locator('.navi-sheet');
  await expect(sheet).toBeVisible({ timeout: 4000 });
  await expect(sheet.locator('.navi-opt')).toHaveText(['티맵 설치', '네이버지도', '카카오맵']);
  await sheet.getByRole('button', { name: '닫기' }).click();
  await expect(sheet).toBeHidden();
});

test('C-3: 장면 상세도 접근성 검사(axe) 위반 0', async ({ page }) => {
  await openFirst(page, '&motion=0');
  await expect(page.locator('.gallery')).not.toHaveClass(/ov-wait/, { timeout: 4500 });
  const r = await new AxeBuilder({ page }).include('.detail').analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});

test('작가 서명 그림이 실제로 뜨고(높이 22), 장면 상세를 연 동안 휴대폰 위쪽 띠는 사진 찍은 달의 색(PR #46)', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T03:00:00Z'));
  await page.goto('./?map=fake&motion=0#/month/1'); // 겨울
  await page.locator('#app main.home:not([hidden])').waitFor();
  const bar = () => page.evaluate(() => [document.querySelector('meta[name=theme-color]')!.getAttribute('content')!.toLowerCase(), getComputedStyle(document.documentElement).backgroundColor]);
  expect((await bar())[0]).toBe('#edf3f8');
  await page.evaluate(() => (location.hash = '#/scene/s-017-boriam')); // 6월 사진 → 여름
  await expect(page.locator('.detail.open')).toBeVisible();
  const sign = page.locator('.detail .credit img.sign');
  await expect.poll(() => sign.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(Math.round((await sign.boundingBox())!.height)).toBe(22);
  expect(await bar()).toEqual(['#e9f3ed', 'rgb(233, 243, 237)']);
  await page.locator('.detail .back').click();
  await expect(page.locator('.detail.open')).toHaveCount(0);
  // 닫으면 아래에 보이는 화면(첫 화면)의 머리 색으로 돌아감
  const under = await page.$eval('#app', (el) => getComputedStyle(el).getPropertyValue('--season-soft').trim().toLowerCase());
  expect((await bar())[0]).toBe(under);
  expect(under).not.toBe('#e9f3ed');
});
