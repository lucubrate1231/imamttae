import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** 홈 화면에 추가(F5-AC1·AC2) 준비와 D33 실기기 확인 페이지 */

test('F5-AC1: 앱이 매니페스트와 아이콘을 내놓음(같은 폴더 기준 상대 주소)', async ({ page }) => {
  await page.goto('./?map=fake&motion=0');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const m = await page.evaluate(async (h) => {
    const url = new URL(h!, location.href);
    const r = await fetch(url);
    const j = await r.json();
    const icons = await Promise.all(j.icons.map((i: { src: string }) => fetch(new URL(i.src, url)).then((x) => x.status)));
    return { status: r.status, name: j.name, icons };
  }, href);
  expect(m).toEqual({ status: 200, name: '이맘때 풍경', icons: [200, 200, 200] });
});

test('F5-AC2: 내 컴퓨터(localhost)에서는 서비스 워커를 등록하지 않음', async ({ page }) => {
  await page.goto('./?map=fake&motion=0');
  await page.locator('#app main').waitFor();
  await page.waitForLoadState('load');
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  expect((await page.request.get('./sw.js')).status()).toBe(200);
});

test('D33 실기기 확인 페이지: 상태 · 카톡→브라우저 두 주소 · 받은 장면 합치기 · 접근성', async ({ page }) => {
  await page.goto('./_review/a2hs-lab.html?carry=s-005-biryong,s-020-naejangsan-uhwajeong,%3Cx%3E');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('설치 실기기 확인');
  await expect(page.getByRole('link', { name: '① 카톡 → 기본 브라우저로 열기' })).toHaveAttribute('href', /^kakaotalk:\/\/web\/openExternal\?url=https?%3A%2F%2F/);
  await expect(page.getByRole('link', { name: '① 카톡 → 크롬으로 열기(intent)' })).toHaveAttribute('href', /^intent:\/\/.+#Intent;scheme=https;package=com\.android\.chrome;/);
  await expect(page.locator('.state')).toContainText('주소로 받은 장면2곳');
  await page.getByRole('button', { name: '② 받은 2곳을 저장한 곳에 합치기' }).click();
  await expect(page.locator('.log')).toContainText('받은 장면 합침: 새로 2곳');
  // 앱의 저장한 곳에 들어옴(같은 저장소)
  await page.goto('./?map=fake&motion=0#/saved');
  await expect(page.locator('.sv-wish .sv-name')).toHaveCount(2);
  await page.goto('./_review/a2hs-lab.html');
  // 저장한 곳이 있으면 넘기는 주소에 장면 번호가 붙음
  await expect(page.getByRole('link', { name: '① 카톡 → 기본 브라우저로 열기' })).toHaveAttribute('href', /carry%3Ds-/);
  const r = await new AxeBuilder({ page }).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
