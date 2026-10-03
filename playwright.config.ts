import { readFileSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// 자동 테스트: 가짜 지도(?map=fake)로 휴대폰 화면 흐름·접근성을 확인합니다.
const exe = process.env.PW_CHROMIUM_PATH; // 클라우드 작업 공간에 미리 설치된 Chromium을 쓸 때

// 테스트용 서버 포트. 같은 컴퓨터에서 Codex와 Claude가 서로 다른 폴더로 동시에 테스트해도 겹치지 않게
// 환경 변수 E2E_PORT → 이 폴더의 .env.local 의 E2E_PORT → 4173 순서로 정합니다(AGENTS.md '같은 컴퓨터에서 동시에').
function fromEnvLocal(key: string): string | undefined {
  try {
    return readFileSync('.env.local', 'utf8').match(new RegExp(`^${key}=(\\d+)`, 'm'))?.[1];
  } catch {
    return undefined;
  }
}
const port = Number(process.env.E2E_PORT || fromEnvLocal('E2E_PORT') || 4173);
const base = `http://localhost:${port}/`;
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: base,
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
    command: `npm run build && npx vite preview --port ${port} --strictPort`,
    url: base,
    // 이미 떠 있는 서버를 다시 쓰지 않음: 다른 폴더(다른 AI)의 서버를 잘못 시험하는 일을 막고, 포트가 겹치면 바로 알려 줌
    reuseExistingServer: false,
    env: { VITE_MAP_MODE: 'fake' },
    timeout: 120_000,
  },
});
