#!/usr/bin/env node
/** 성능 예산: 휴대폰에서 첫 화면이 빨리 뜨도록 앱 JS와 데이터 크기를 제한합니다(압축 전 기준이 아니라 gzip 기준). */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = { js: 50 * 1024, css: 20 * 1024, json: 120 * 1024 };
if (!existsSync('dist')) {
  console.error('✗ dist 가 없습니다. 먼저 npm run build');
  process.exit(1);
}
const sums = { js: 0, css: 0, json: 0 };
function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (p === join('dist', '_review', 'places') || p === join('dist', '_review', 'covers')) continue; // 좌표 확인 페이지 데이터 — 앱이 받지 않음(미리보기 검토용)
    if (statSync(p).isDirectory()) walk(p);
    else {
      const ext = extname(p).slice(1);
      if (ext in sums) sums[ext] += gzipSync(readFileSync(p)).length;
    }
  }
}
walk('dist');
let fail = false;
for (const k of Object.keys(BUDGET)) {
  const ok = sums[k] <= BUDGET[k];
  if (!ok) fail = true;
  console.log(`${ok ? '✓' : '✗'} ${k.toUpperCase()} ${(sums[k] / 1024).toFixed(1)}KB / 예산 ${(BUDGET[k] / 1024).toFixed(0)}KB (gzip)`);
}
process.exit(fail ? 1 : 0);
