#!/usr/bin/env node
/**
 * 비밀 키 검사: 카카오 REST 키가 저장소 파일이나 배포물(dist)에 들어가지 않았는지 확인합니다.
 * - KAKAO_REST_KEY 환경 변수가 있으면 그 값 자체를 찾습니다(값은 출력하지 않음).
 * - .env, .env.local 같은 설정 파일이 저장소에 올라가려 하면 막습니다.
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];
const rest = (process.env.KAKAO_REST_KEY || '').trim();

let tracked = [];
try {
  tracked = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch {
  tracked = [];
}
for (const f of tracked) {
  if (/(^|\/)\.env(\..+)?$/.test(f) && !f.endsWith('.env.example')) problems.push(`설정 파일이 저장소에 들어가려 함: ${f}`);
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = [...tracked.filter((f) => existsSync(f) && !f.startsWith('node_modules/')), ...walk('dist')];

if (rest) {
  if (rest.length < 16) problems.push('KAKAO_REST_KEY 값이 이상합니다(너무 짧음)');
  for (const f of files) {
    let text = '';
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    if (text.includes(rest)) problems.push(`카카오 REST 키가 들어 있음: ${f}`);
  }
}

if (problems.length) {
  console.error('✗ 비밀 키 검사 실패');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log(`✓ 비밀 키 검사 통과 (파일 ${files.length}개${rest ? ', REST 키 값 대조함' : ', REST 키 값 없이 파일 이름만 검사'})`);
