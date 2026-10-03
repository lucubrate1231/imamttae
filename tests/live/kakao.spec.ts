import { expect, test } from '@playwright/test';

// 실제 카카오 지도가 뜨는지 확인합니다(도메인 등록·키·사용 설정 확인용). 사용량을 쓰므로 자동 테스트와 분리.
test('실제 카카오 지도가 뜨고, 장면 점이 올라가며, 첫 카드 장소가 골라진다(F1-AC5)', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (m) => warnings.push(m.text()));
  await page.goto('./#/month/10');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('10월에 만나는 자연');
  const ok = await page.waitForFunction(() => Boolean((window as unknown as { kakao?: { maps?: { Map?: unknown } } }).kakao?.maps?.Map), null, { timeout: 15_000 });
  expect(ok).toBeTruthy();
  await expect(page.locator('.mapfail')).toHaveCount(0);
  // 지도 타일 이미지가 실제로 그려졌는가
  await expect.poll(async () => page.locator('.kmap img').count(), { timeout: 15_000 }).toBeGreaterThan(4);
  // 제철 점이 올라가고, 첫 카드 장소에 이름표가 붙음
  await expect.poll(async () => page.locator('.kmap .pin.p').count(), { timeout: 10_000 }).toBeGreaterThan(0);
  const first = await page.locator('.rail .big .cap b').first().textContent();
  await expect(page.locator('.kmap .pin.on .nm')).toHaveText(first ?? '', { timeout: 10_000 });
  expect(warnings.filter((w) => w.includes('지도 대체'))).toEqual([]);
});
