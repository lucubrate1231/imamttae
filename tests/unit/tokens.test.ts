import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * 디자인 토큰의 원본은 src/styles/tokens.css 하나입니다(CLAUDE.md '구조', docs/design-guide.md).
 * 시안 v2(src/review/v2.css)와 실제 앱이 같은 값을 쓰게, 값은 토큰 파일에만 두고 나머지는 가져다 씁니다.
 * 색 값은 docs/design-guide.md 3절 표와 같아야 합니다.
 */
const read = (p: string) => readFileSync(p, 'utf8');
const tokens = () => read('src/styles/tokens.css');
const v2css = () => read('src/review/v2.css');
const v2html = () => read('_review/v2.html');

/** `:root { ... }` 블록 안에서 --이름: 값; 을 찾음 */
function rootVar(css: string, name: string): string | undefined {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  return root.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1]?.trim();
}
/** `[data-season='봄'] { ... }` 한 줄에서 --이름 값을 찾음 */
function seasonVar(css: string, season: string, name: string): string | undefined {
  const block = css.match(new RegExp(`\\[data-season=['"]${season}['"]\\]\\s*\\{([^}]*)\\}`))?.[1] ?? '';
  return block.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1]?.trim().toLowerCase();
}

describe('디자인 토큰 원본(tokens.css)', () => {
  it('라이트 모드만 둠: 다크 모드 규칙이 없고 color-scheme은 light', () => {
    const css = tokens();
    expect(css).not.toMatch(/prefers-color-scheme/);
    expect(css).not.toMatch(/data-theme/);
    expect(rootVar(css, '--color-scheme') ?? css.match(/color-scheme\s*:\s*light/)?.[0]).toBeTruthy();
  });

  it('본문·보조 글자 색은 디자인 가이드 값', () => {
    const css = tokens();
    expect(rootVar(css, '--ink')?.toLowerCase()).toBe('#3a3d3b');
    expect(rootVar(css, '--ink-2')?.toLowerCase()).toBe('#4f5753');
    expect(rootVar(css, '--ink-3')?.toLowerCase()).toBe('#5f6963');
    expect(rootVar(css, '--bg')?.toLowerCase()).toBe('#ffffff');
  });

  it('계절 색 4가지(강조·바탕·제목 글자)는 디자인 가이드 표와 같음, 기본값은 가을', () => {
    const css = tokens();
    const guide = {
      spring: { season: '#b0466b', soft: '#fbeef3', title: '#2e1f26' },
      summer: { season: '#2e6b4a', soft: '#e9f3ed', title: '#1c2a22' },
      autumn: { season: '#b0502a', soft: '#fbefe8', title: '#2e221d' },
      winter: { season: '#466a86', soft: '#edf3f8', title: '#1e2632' },
    };
    for (const [s, v] of Object.entries(guide)) {
      expect(seasonVar(css, s, '--season'), `${s} --season`).toBe(v.season);
      expect(seasonVar(css, s, '--season-soft'), `${s} --season-soft`).toBe(v.soft);
      expect(seasonVar(css, s, '--ink-title'), `${s} --ink-title`).toBe(v.title);
    }
    expect(rootVar(css, '--season')?.toLowerCase()).toBe(guide.autumn.season);
    expect(rootVar(css, '--season-soft')?.toLowerCase()).toBe(guide.autumn.soft);
    expect(rootVar(css, '--ink-title')?.toLowerCase()).toBe(guide.autumn.title);
  });

  it('글꼴: 본문은 IBM Plex Sans KR, 제목·작가의 한마디는 고운바탕. 내려받기는 토큰 파일 한곳에서(C-9)', () => {
    const css = tokens();
    expect(rootVar(css, '--font-body')).toMatch(/IBM Plex Sans KR/);
    expect(rootVar(css, '--font-display')).toMatch(/Gowun Batang/);
    // 본문 고딕은 구글에서. 제목 명조(고운바탕)는 앱 안의 파일 하나로(10/3 사용자 결정, tests/contract/titleFont.test.ts)
    const imp = css.match(/@import\s+url\(["']?(https:\/\/fonts\.googleapis\.com[^"')]+)/)?.[1] ?? '';
    expect(imp).toMatch(/IBM\+Plex\+Sans\+KR:wght@400;600;700/);
    expect(imp).toMatch(/display=swap/);
    expect(css).toMatch(/@font-face\s*\{[^}]*Gowun Batang/);
  });

  it('크기 토큰: 글자 18px·누르는 곳 48px·버튼 56px·모서리·아래 메뉴 높이', () => {
    const css = tokens();
    expect(rootVar(css, '--fs-body')).toBe('18px');
    expect(rootVar(css, '--fs-meta')).toBe('16px');
    expect(rootVar(css, '--tap')).toBe('48px');
    expect(rootVar(css, '--btn')).toBe('56px');
    expect(rootVar(css, '--r-card')).toBe('28px');
    expect(rootVar(css, '--r-photo')).toBe('24px');
    expect(rootVar(css, '--r-pill')).toBe('999px');
    expect(rootVar(css, '--gutter')).toBe('16px');
    expect(rootVar(css, '--tabs-h')).toBe('68px');
  });

  it('옛 첫 화면의 옛 이름(--c-*)은 옛 화면과 함께 지움(기능 ①을 실제 앱으로 옮길 때)', () => {
    expect(tokens()).not.toMatch(/--c-[a-z]/);
  });
});

describe('시안 v2와 실제 앱은 같은 토큰·같은 모양 파일을 씀', () => {
  const appcss = () => read('src/styles/app.css');

  it('v2.css에 색·크기 원본(:root, [data-season])이 남아 있지 않고 tokens.css와 app.css를 가져옴', () => {
    const css = v2css();
    expect(css).toMatch(/@import\s+['"]\.\.\/styles\/tokens\.css['"]/);
    expect(css).toMatch(/@import\s+['"]\.\.\/styles\/app\.css['"]/);
    expect(css).not.toMatch(/:root\s*\{/);
    expect(css).not.toMatch(/\[data-season=/);
  });

  it('모양 파일(app.css)에도 색·크기 원본이 없고, 글꼴은 이름 대신 토큰(--font-body)을 씀', () => {
    const css = appcss();
    expect(css).not.toMatch(/:root\s*\{/);
    expect(css).not.toMatch(/\[data-season=/);
    expect(css).not.toMatch(/'IBM Plex Sans KR'/);
    expect(css).toMatch(/var\(--font-body\)/);
  });

  it('실제 앱도 같은 두 파일을 가져옴(옛 base.css 없음)', () => {
    const main = read('src/main.ts');
    expect(main).toMatch(/import ['"]\.\/styles\/tokens\.css['"]/);
    expect(main).toMatch(/import ['"]\.\/styles\/app\.css['"]/);
    expect(main).not.toMatch(/base\.css/);
  });

  it('v2.html에는 구글 글꼴 링크가 없음(토큰 파일이 내려받음)', () => {
    expect(v2html()).not.toMatch(/fonts\.googleapis\.com\/css2/);
  });
});
