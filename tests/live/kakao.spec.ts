import { expect, test } from '@playwright/test';

// 실제 카카오 지도가 뜨는지 확인합니다(도메인 등록·키·사용 설정 확인용).
test('실제 카카오 지도가 뜬다', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => warnings.push(m.text()));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: '이맘때 자연' })).toBeVisible();
  await expect(page.locator('[role="alert"]')).toHaveCount(0, { timeout: 15_000 });
  const ok = await page.waitForFunction(() => Boolean((window as unknown as { kakao?: { maps?: { Map?: unknown } } }).kakao?.maps?.Map), null, { timeout: 15_000 });
  expect(ok).toBeTruthy();
  // 지도 타일 이미지가 실제로 그려졌는가
  await expect.poll(async () => page.locator('.mapcanvas img').count(), { timeout: 15_000 }).toBeGreaterThan(4);
  expect(warnings.filter((w) => w.includes('지도 대체'))).toEqual([]);
});
