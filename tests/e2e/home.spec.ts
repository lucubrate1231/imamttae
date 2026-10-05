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

test('작은 제목 막대는 첫 화면에만 — 스크롤한 채로 풍경 찾기·저장한 곳으로 가도 남지 않음(10/4 사용자 휴대폰 확인)', async ({ page }) => {
  await open(page, '#/month/10');
  const mini = page.locator('.mini-ttl');
  for (const tab of ['풍경 찾기', '저장한 곳']) {
    await page.mouse.wheel(0, 900);
    await expect(mini).toBeVisible();
    await expect(mini).toHaveCSS('opacity', '1');
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('10월에 만나는 풍경');
    await expect(mini, tab).toBeHidden();
    await page.getByRole('button', { name: '지금 풍경', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: /월에 만나는 풍경/ })).toBeVisible();
  }
});

test('C-1: 320px 폭에서 가로로 밀리지 않음(모든 달)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const m of [1, 5, 8, 10]) {
    await open(page, `#/month/${m}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  }
});

test('아이폰 사파리 주소창 뒤 색(iOS 26): body 배경이 그 화면 머리의 계절 색이고, 닫힌 상세 같은 맨 위 고정 요소가 흰색을 끼어들게 하지 않음(10/4·10/5 사용자)', async ({ page }) => {
  // iOS 26 사파리는 theme-color 대신 body 배경색을 쓰고, 맨 위에 붙은 고정 요소(폭 80% 이상, 높이 3px 이상, 숨김이어도)가 있으면 그 색을 먼저 씀.
  // 투명도가 1보다 낮거나 display:none인 것은 빼고 봄(github.com/andesco/safari-color-tinting)
  const soft = () => page.$eval('#app', (el) => getComputedStyle(el).getPropertyValue('--season-soft').trim().toLowerCase());
  const hex = (rgb: string) => '#' + rgb.match(/\d+/g)!.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  const bg = (sel: string) => page.$eval(sel, (el) => getComputedStyle(el).backgroundColor);
  const meta = () => page.$eval('meta[name=theme-color]', (m) => m.getAttribute('content')!.toLowerCase());
  /** 사파리가 색을 가져갈 만한 맨 위 고정 요소(투명도 1, 보이는 것) */
  const topFixed = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((el) => {
          const cs = getComputedStyle(el);
          if (cs.position !== 'fixed' && cs.position !== 'sticky') return false;
          if (cs.display === 'none' || Number(cs.opacity) < 1) return false;
          const r = el.getBoundingClientRect();
          return r.top <= 4 && r.bottom > 0 && r.width >= innerWidth * 0.8 && r.height >= 3;
        })
        .map((el) => el.className),
    );
  await open(page, '#/month/4');
  expect(hex(await bg('body'))).toBe(await soft()); // 봄
  expect(hex(await bg('html'))).toBe(await soft());
  expect(await meta()).toBe(await soft());
  expect(await topFixed()).toEqual([]); // 닫힌 장면 상세(맨 위 고정, 흰 바탕)가 끼어들지 않음
  await page.getByRole('button', { name: '풍경 찾기', exact: true }).click();
  await expect(page).toHaveURL(/#\/find$/);
  await expect.poll(async () => hex(await bg('body'))).toBe(await soft());
  expect(await topFixed()).toEqual([]);
  await page.getByRole('button', { name: '저장한 곳', exact: true }).click();
  await expect.poll(async () => hex(await bg('body'))).toBe(await soft());
  // 바깥 배경을 칠해도 화면 본문은 흰 바탕 그대로
  expect(await bg('#app')).toBe('rgb(255, 255, 255)');
  // 장면 상세를 열었다 닫아도 닫힌 상세는 다시 빠짐
  await page.getByRole('button', { name: '지금 풍경', exact: true }).click();
  await page.locator('.big').first().click();
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.locator('.detail .back').click();
  await expect(page.locator('.detail.open')).toHaveCount(0);
  await expect.poll(topFixed).toEqual([]);
});

test('장면 상세를 연 동안 사파리가 가져가는 색(맨 위 고정 요소의 배경색)은 사진 찍은 달의 계절 색, 눈에 보이는 바탕은 흰색(10/5)', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-04T03:00:00Z'));
  await page.goto('./?map=fake&motion=0#/scene/s-017-boriam'); // 6월 사진 → 여름
  await expect(page.locator('.detail.open')).toBeVisible();
  const d = await page.$eval('.detail', (el) => {
    const cs = getComputedStyle(el);
    return { color: cs.backgroundColor, image: cs.backgroundImage, soft: cs.getPropertyValue('--season-soft').trim().toLowerCase() };
  });
  expect(d.soft).toBe('#e9f3ed');
  expect(d.color).toBe('rgb(233, 243, 237)');
  expect(d.image).toContain('linear-gradient'); // 흰 그림으로 덮어 보이는 바탕은 흰색
});

test('지도 점은 가운데가 그 장소(아래 끝이 아님) — 카카오는 점 묶음의 아래 끝을 좌표에 둠(yAnchor 1), 전국 지도에서 30km 어긋나 비룡폭포가 바다에 찍히던 것(10/5)', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/month/10');
  await page.locator('.rail .big').first().waitFor();
  const gaps = await page.evaluate(() => {
    const host = document.querySelector('.mapsec .kmap')!;
    return ['pin p', 'pin p on', 'pin r', 'pin ph'].map((cls) => {
      const el = document.createElement('div');
      el.className = cls;
      el.innerHTML = '<div class="nm">이름</div><div class="dot"></div>';
      el.style.position = 'absolute';
      host.append(el);
      const box = el.getBoundingClientRect();
      const dot = el.querySelector('.dot')!.getBoundingClientRect();
      el.remove();
      return Math.abs(box.bottom - (dot.top + dot.height / 2)); // 카카오가 좌표에 두는 아래 끝 ↔ 점 가운데
    });
  });
  for (const g of gaps) expect(g).toBeLessThanOrEqual(0.5);
});

test('카카오가 지도 칸에 position: relative를 박아도 칸 높이는 그대로(10/6 — 화면 스타일보다 지도가 먼저 만들어지면 칸 높이가 0이 되어 지도가 안 뜸)', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/month/10');
  await page.locator('.rail .big').first().waitFor();
  const h = await page.evaluate(() => {
    const k = document.querySelector<HTMLElement>('.mapsec .kmap')!;
    k.setAttribute('style', 'position: relative; overflow: hidden;'); // 카카오 지도 SDK가 하는 것
    return [k.clientHeight, k.clientWidth, k.parentElement!.clientWidth];
  });
  expect(h[0]).toBe(210);
  expect(h[1]).toBe(h[2]);
});
