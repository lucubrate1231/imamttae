import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// 크롬의 처음 [저장] 판(F5-AC6)은 이미 본 것으로 — 여기서는 저장 뒤 흐름을 봄(판은 a2hs.spec.ts)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('imamttae:a2hs', JSON.stringify({ sheetShown: true })));
});

/** [다녀왔어요] → 도장 찍히는 순간 → 저장한 곳 도장 모음(F4-AC4~AC7·AC14) — 가짜 지도 */
const ID = 's-020-naejangsan-uhwajeong';
const NAME = '내장산 우화정';

async function openScene(page: Page, id = ID): Promise<void> {
  await page.goto(`./?map=fake&motion=0#/scene/${id}`);
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function saveAndVisit(page: Page): Promise<void> {
  await openScene(page);
  await page.locator('.detail .dact[aria-pressed]').click();
  await expect(page.locator('.detail .vbox')).toContainText('저장된 곳이에요');
  await page.locator('.vbox-go').click();
  await expect(page.getByRole('dialog', { name: '도장을 찍었어요' })).toBeVisible();
}
const today = () => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(new Date());

test('F4-AC4·AC5·AC7·AC14: 저장 → [다녀왔어요] → 도장 → [확인] → 저장한 곳 도장 모음, 새로고침해도 남음', async ({ page }) => {
  await saveAndVisit(page);
  const m = page.getByRole('dialog', { name: '도장을 찍었어요' });
  await expect(m.locator('.sm-ttl')).toHaveText(`${NAME}에 다녀왔어요`);
  await expect(m.locator('.sm-date')).toHaveText(`다녀온 날 ${today()} (오늘)`);
  // 큰 도장 그림이 실제로 불러와짐
  await expect.poll(() => m.locator('.sm-stamp img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(384);
  await m.getByRole('button', { name: '확인' }).click();
  await expect(m).toHaveCount(0);
  await expect(page.locator('.detail .vbox.done .vbox-msg')).toHaveText(`${today()}에 다녀왔어요`);

  await page.goto('./?map=fake&motion=0#/saved');
  await page.reload();
  await expect(page.locator('.saved .sv-stamp b')).toHaveText([NAME]);
  await expect(page.locator('.saved .sv-visit-sub')).toContainText('올해 다녀온 곳 1곳');
  await expect(page.locator('.saved .sv-wish')).toHaveCount(0); // 가고 싶은 곳에서 빠짐
  await page.locator('.saved .sv-stamp').click();
  await expect(page.locator('.detail.open .vbox.done')).toBeVisible();
});

test('F4-AC6: [날짜 변경] → 날짜 고르기 → [바꾸기], 그리고 다녀온 기록 지우기(한 번 더 물음)', async ({ page }) => {
  await saveAndVisit(page);
  await page.getByRole('button', { name: '확인' }).click();
  await page.locator('.vbox-change').click();
  const sheet = page.getByRole('dialog', { name: '다녀온 날 변경' });
  await expect(sheet).toBeVisible();
  const d = new Date(Date.now() - 3 * 864e5);
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(d);
  await sheet.getByLabel('다녀온 날').fill(iso);
  await sheet.getByRole('button', { name: '바꾸기' }).click();
  await expect(sheet).toHaveCount(0);
  const shown = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(d);
  // 3일 전이 지난해면(1월 초) 올해 상자는 사라짐 — 그때는 이 줄을 건너뜀
  if (iso.slice(0, 4) === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()).slice(0, 4)) {
    await expect(page.locator('.vbox.done .vbox-msg')).toHaveText(`${shown}에 다녀왔어요`);
    await page.locator('.vbox-change').click();
    await page.getByRole('button', { name: '다녀온 기록 지우기' }).click();
    await expect(page.getByRole('heading', { name: '다녀온 기록을 지울까요?' })).toBeVisible();
    await page.getByRole('button', { name: '지우기', exact: true }).click();
    await expect(page.locator('.detail .vbox .vbox-msg')).toHaveText('저장된 곳이에요');
    await expect(page.locator('.detail .dact[aria-pressed]')).toHaveAttribute('aria-pressed', 'true');
  }
});

test('C-1·C-2: 320px 폭에서 상자·도장 순간·날짜 창이 넘치지 않고, 누르는 곳은 48px 이상', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const small = (sel: string) =>
    page.$$eval(sel, (els) =>
      els
        .filter((e) => (e as HTMLElement).offsetParent !== null && getComputedStyle(e).opacity !== '0')
        .map((e) => ({ t: (e.textContent ?? '').trim().slice(0, 12), r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.height < 48)
        .map(({ t, r }) => `${t} ${Math.round(r.height)}px`),
    );
  const over = (sel: string) => page.$eval(sel, (e) => e.scrollWidth - e.clientWidth);
  await openScene(page);
  await page.locator('.detail .dact[aria-pressed]').click();
  expect(await small('.vbox button')).toEqual([]);
  expect(await over('.detail')).toBeLessThanOrEqual(0);
  await page.locator('.vbox-go').click();
  expect(await small('.stamp-moment button')).toEqual([]);
  expect(await over('.stamp-moment')).toBeLessThanOrEqual(0);
  const box = await page.locator('.stamp-moment').boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  await page.getByRole('button', { name: '확인' }).click();
  expect(await small('.vbox button')).toEqual([]);
  await page.locator('.vbox-change').click();
  expect(await small('.vsheet button')).toEqual([]);
  expect(await over('.vsheet')).toBeLessThanOrEqual(0);
});

test('C-3: 상자·도장 순간·날짜 창·지우기 확인 접근성 검사(axe) 위반 0', async ({ page }) => {
  const check = async (sel: string, what: string) => {
    const r = await new AxeBuilder({ page }).include(sel).analyze();
    expect(r.violations.map((v) => `${what} ${v.id}: ${v.help} ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
  };
  await openScene(page);
  await page.locator('.detail .dact[aria-pressed]').click();
  await check('.vbox', '저장된 곳 상자');
  await page.locator('.vbox-go').click();
  await page.waitForTimeout(800); // 도장 움직임이 끝난 뒤
  await check('.stamp-moment', '도장 순간');
  await page.getByRole('button', { name: '확인' }).click();
  await check('.vbox', '다녀온 상자');
  await page.locator('.vbox-change').click();
  await check('.vsheet', '날짜 창');
  await page.getByRole('button', { name: '다녀온 기록 지우기' }).click();
  await check('.vsheet', '지우기 확인');
});

test('도장은 짧게 "쿵" 움직이고(0.4초 안팎), 동작 줄이기가 켜져 있으면 움직이지 않음', async ({ page }) => {
  await saveAndVisit(page);
  const anim = () => page.locator('.sm-stamp img').evaluate((i) => ({ name: getComputedStyle(i).animationName, dur: getComputedStyle(i).animationDuration }));
  expect(await anim()).toEqual({ name: 'thud', dur: '0.46s' }); // 디자인 #54 2차: 공중에서 내려와 닿는 순간 '쿵'
  const extra = await page.evaluate(() => {
    const cs = (sel: string) => getComputedStyle(document.querySelector(sel)!);
    const img = document.querySelector<HTMLImageElement>('.sm-stamp img')!;
    return { size: [img.getAttribute('width'), cs('.sm-stamp img').width], line: [cs('.sm-line').animationName, cs('.sm-line').animationDelay, cs('.sm-line').animationDuration], press: [cs('.sm-press').animationName, cs('.sm-press').animationDelay] };
  });
  expect(extra).toEqual({ size: ['148', '148px'], line: ['thud-line', '0.18s', '0.32s'], press: ['sm-press', '0.18s'] });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: '확인' }).click();
  await page.locator('.vbox-change').click();
  await page.getByRole('button', { name: '다녀온 기록 지우기' }).click();
  await page.getByRole('button', { name: '지우기', exact: true }).click();
  await page.locator('.vbox-go').click();
  expect((await anim()).name).toBe('none');
  expect(await page.evaluate(() => [getComputedStyle(document.querySelector('.sm-line')!).animationName, getComputedStyle(document.querySelector('.sm-press')!).animationName, getComputedStyle(document.querySelector('.sm-line')!).opacity])).toEqual(['none', 'none', '0']);
});

test('[저장] 직후 [다녀왔어요]를 눌러도 "저장했어요" 안내 줄이 도장 카드 위에 겹치지 않음(10/5)', async ({ page }) => {
  await page.goto('./?map=fake&motion=0#/scene/s-020-naejangsan-uhwajeong');
  await expect(page.locator('.detail.open')).toBeVisible();
  await page.locator('.detail .dact[aria-pressed]').click();
  await expect(page.locator('.toast')).toHaveClass(/on/);
  await page.locator('.vbox-go').click();
  await expect(page.locator('.stamp-moment')).toBeVisible();
  await expect(page.locator('.toast')).toBeHidden();
});
