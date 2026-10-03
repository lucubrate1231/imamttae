import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TITLE_FONT, titleChars } from '../../scripts/build-title-font';

/**
 * 제목 글꼴(고운바탕) — 10/3 사용자 결정: 앱이 직접 갖기, 오는 동안은 잠깐 비워 두기.
 * 구글 조각(95개)으로 받으면 늦게 온 조각의 글자만 다른 글꼴로 섞여 보였습니다('덮·밭·쭉·릇').
 * 제목·작가의 한마디에 쓰는 글자만 담은 파일 하나를 앱에 두면 섞일 수 없습니다.
 * 장면 데이터를 바꾼 뒤 이 검사가 실패하면: npx tsx scripts/build-title-font.ts
 */
const read = (p: string) => readFileSync(p, 'utf8');

describe('제목 글꼴 파일(앱이 직접 가짐)', () => {
  it('글꼴 파일이 있고 80KB 이하', () => {
    expect(existsSync(TITLE_FONT.woff2)).toBe(true);
    expect(statSync(TITLE_FONT.woff2).size).toBeLessThanOrEqual(80 * 1024);
  });

  it('무료 공개 글꼴 사용 허락서(OFL)를 함께 둠', () => {
    expect(read(TITLE_FONT.license)).toMatch(/SIL OPEN FONT LICENSE/i);
  });

  it('장면 데이터의 모든 이름·작가 글 대목과 화면 제목 글자가 글꼴 파일에 들어 있음', () => {
    const have = new Set(read(TITLE_FONT.chars));
    const scenes = JSON.parse(read('public/data/scenes.json'));
    const missing = [...titleChars(scenes)].filter((c) => !have.has(c));
    expect(missing.join(''), '빠진 글자가 있으면 npx tsx scripts/build-title-font.ts 로 다시 만드세요').toBe('');
  });

  it('토큰 파일: 고운바탕은 앱 안의 파일로, 오는 동안은 비워 둠(font-display: block). 구글에서는 받지 않음', () => {
    const css = read('src/styles/tokens.css');
    const face = css.match(/@font-face\s*\{[^}]*\}/)?.[0] ?? '';
    expect(face).toMatch(/font-family:\s*['"]Gowun Batang['"]/);
    expect(face).toMatch(/url\(['"]?\.\/fonts\/gowun-batang-title\.woff2['"]?\)\s*format\(['"]woff2['"]\)/);
    expect(face).toMatch(/font-weight:\s*700/);
    expect(face).toMatch(/font-display:\s*block/);
    expect(css).not.toMatch(/Gowun\+Batang/);
    expect(css).toMatch(/IBM\+Plex\+Sans\+KR/); // 본문 고딕은 그대로 구글에서
  });
});
