import { defineConfig, devices } from '@playwright/test';

// 자동 테스트: 가짜 지도(?map=fake)로 휴대폰 화면 흐름·접근성을 확인합니다.
const exe = process.env.PW_CHROMIUM_PATH; // 클라우드 작업 공간에 미리 설치된 Chromium을 쓸 때
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'retain-on-failure',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    ...(exe ? { launchOptions: { executablePath: exe } } : {}),
  },
  projects: [
    { name: 'phone-390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 }, browserName: 'chromium' } },
    { name: 'phone-360', use: { ...devices['Galaxy S9+'], viewport: { width: 360, height: 740 }, browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    env: { VITE_MAP_MODE: 'fake' },
    timeout: 120_000,
  },
});
