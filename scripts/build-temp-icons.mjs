// 임시 앱 아이콘(F5-AC1) — 디자인 세션이 진짜 아이콘을 줄 때까지 단풍 도장 그림으로 만듦
// 다시 만들기: node scripts/build-temp-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const stamp = `data:image/webp;base64,${readFileSync('public/stamps/danpung-384.webp').toString('base64')}`;
const out = [
  ['public/icons/icon-192.png', 192, 0.8],
  ['public/icons/icon-512.png', 512, 0.8],
  ['public/icons/icon-maskable-512.png', 512, 0.62], // 가운데 80% 안전 구역 안에
  ['public/icons/apple-touch-icon-180.png', 180, 0.8],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, k] of out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:#fbefe8"><img src="${stamp}" style="width:${Math.round(size * k)}px;height:${Math.round(size * k)}px"></body>`,
  );
  await page.waitForFunction(() => document.images[0].complete);
  await page.screenshot({ path: file, omitBackground: false });
}
await browser.close();
console.log('임시 아이콘', out.length, '개');
