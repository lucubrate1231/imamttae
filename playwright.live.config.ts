import { defineConfig, devices } from '@playwright/test';

// 실제 카카오 지도 확인(사용량을 쓰므로 자동 테스트와 분리). 
// LIVE_URL 이 없으면 localhost:8080(카카오에 등록한 시험 주소)에서 개발 서버로 확인합니다.
const exe = process.env.PW_CHROMIUM_PATH;
const liveUrl = process.env.LIVE_URL;
export default defineConfig({
  testDir: 'tests/live',
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: liveUrl ?? 'http://localhost:8080/',
    ...devices['Pixel 7'],
    browserName: 'chromium',
    ...(exe ? { launchOptions: { executablePath: exe } } : {}),
  },
  ...(liveUrl
    ? {}
    : { webServer: { command: 'npx vite --port 8080 --strictPort', url: 'http://localhost:8080/', reuseExistingServer: true, timeout: 60_000 } }),
});
