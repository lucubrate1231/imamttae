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

test('지도 범례는 "제철 풍경 · 작가 부부 방문"', async ({ page }) => {
  await open(page, '?m=10');
  await expect(page.locator('.legend span').first()).toHaveText('제철 풍경');
  await expect(page.locator('.legend span.r')).toHaveText('작가 부부 방문');
});

test('넘김 화살표로 다음 사진에 가면 버튼이 숨었다가 약 0.5초 안에 다시 다 보임', async ({ page }) => {
  await open(page, '?m=10');
  await page.locator('.big').first().click();
  const gallery = page.locator('.gallery');
  await expect(gallery).not.toHaveClass(/ov-wait/, { timeout: 4500 });
  // 누른 순간부터 버튼이 다시 나오기 시작할 때까지(페이지 안에서 잼)
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
  expect(t.hidden).toBe(true); // 누르면 바로 숨음
  const fade = await page.$eval('.gallery .back', (b) => parseFloat(getComputedStyle(b).transitionDuration));
  expect(t.back).toBeGreaterThan(150); // 넘어가는 동안 잠깐은 숨어 있음
  expect(t.back + fade * 1000).toBeLessThanOrEqual(560); // 다 보이기까지 약 0.5초(10/3: 0.9초 → 0.5초)
  await expect(page.locator('.gdots i').nth(1)).toHaveClass(/on/);
});

test('추천 시기 칸의 안내 글은 내어쓰기 없이 "올해 ○○ 소식 찾아보기"와 왼쪽이 맞음', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await open(page, '?m=10');
  await page.locator('.big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
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
  expect(r.multi).toBe(true); // 두 줄 이상인 글로 확인
  expect(Math.abs(r.lastLeft - r.linkLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(r.linkLeft - r.rowLeft)).toBeLessThanOrEqual(1);
});

test('올해 소식 찾아보기: 단풍 장면은 "올해 + 단풍지도 + 시기"로 구글 검색(D40)', async ({ page }) => {
  await open(page, '?m=10');
  await page.locator('.big').first().click();
  const link = page.locator('.when-link');
  await expect(link).toHaveText('올해 단풍지도 찾아보기 ›');
  const q = new URL((await link.getAttribute('href'))!).searchParams.get('q');
  expect(q).toBe(`${new Date().getFullYear()} 단풍지도 시기`);
});

test('장면 상세에는 "작가 부부 방문" 꼬리표를 두지 않음(사진 안내 문구로 충분)', async ({ page }) => {
  await open(page, '?m=8');
  await page.locator('.rec').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await expect(page.locator('.detail .body .badges')).not.toContainText('작가 부부 방문');
  await expect(page.locator('.detail .recnote')).toContainText('사진은 작가 부부가');
});

// ── 사진 움직임: 기본으로 켬(10/3 사용자 확정), ?motion=0 이면 끔 ──
const kbState = (page: Page) =>
  page.$$eval('.gallery .kb', (els) => els.map((e) => e.getAnimations().some((a) => a.playState === 'running')));

test('사진 움직임(기본): 지금 사진만 아주 천천히(10초 넘게) 움직이고, 넘기면 새 사진이 처음부터 움직임', async ({ page }) => {
  await open(page, '?m=10');
  await page.locator('.big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await expect.poll(async () => (await kbState(page))[0]).toBe(true);
  expect((await kbState(page)).slice(1).every((x) => !x)).toBe(true);
  const dur = await page.$eval('.gallery .kb', (e) => parseFloat(getComputedStyle(e).animationDuration));
  expect(dur).toBeGreaterThanOrEqual(10);
  await page.locator('.gallery .next').click();
  await expect.poll(async () => (await kbState(page)).slice(0, 2), { timeout: 3000 }).toEqual([false, true]);
});

test('사진 움직임: 주소에 ?motion=0 을 붙이면 움직이지 않음(비교·점검용)', async ({ page }) => {
  await open(page, '?m=10&motion=0');
  await page.locator('.big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await expect(page.locator('.gallery .kb')).toHaveCount(0);
});

test('사진 움직임: 휴대폰에서 "동작 줄이기"를 켜면 움직이지 않음', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, '?m=10');
  await page.locator('.big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.waitForTimeout(1500);
  expect((await kbState(page)).some((x) => x)).toBe(false);
});

test('달을 바꾸면 계절 색이 토큰 값대로(4월 봄 #B0466B, 1월 겨울 #466A86)', async ({ page }) => {
  const seasonOf = () => page.$eval('#app', (el) => getComputedStyle(el).getPropertyValue('--season').trim().toLowerCase());
  await open(page, '?m=4');
  expect(await seasonOf()).toBe('#b0466b');
  await open(page, '?m=1');
  expect(await seasonOf()).toBe('#466a86');
});
