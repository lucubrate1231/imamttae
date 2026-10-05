import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromeIntentUrl, kakaoExternalUrl, readCarry, shouldRegisterSw, withCarry } from '../../src/pwa';

/** 홈 화면에 추가(F5-AC1·AC2) 준비 파일과 D33 실기기 확인용 주소 만들기 */
const pub = (p: string) => resolve(__dirname, '../../public', p);
const pngSize = (file: string) => {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString()).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe('F5-AC1: 웹 앱 매니페스트', () => {
  const manifest = () => JSON.parse(readFileSync(pub('manifest.webmanifest'), 'utf8'));

  it('이름 · 아이콘 이름(이맘때) · 시작 주소 · 전체 화면 표시', () => {
    const m = manifest();
    expect(m.name).toBe('이맘때 풍경');
    expect(m.short_name).toBe('이맘때');
    expect(m.lang).toBe('ko');
    // 상대 주소: 같은 빌드가 /imamttae/(알파)와 /imamttae/next/(미리보기)에서 따로 설치됨
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    expect(m.id).toBe('./');
    expect(m.display).toBe('standalone');
    expect(m.background_color.toLowerCase()).toBe('#ddecd9'); // 아이콘 바탕과 같게(design-guide 11-6)
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('아이콘 192·512px(그림 파일이 실제 그 크기) + 가장자리가 잘려도 되는 아이콘(maskable)', () => {
    const icons = manifest().icons as { src: string; sizes: string; type: string; purpose?: string }[];
    for (const size of [192, 512]) {
      const i = icons.find((x) => x.sizes === `${size}x${size}` && (x.purpose ?? 'any') === 'any');
      expect(i, `${size} any`).toBeTruthy();
      expect(i!.type).toBe('image/png');
      expect(pngSize(pub(i!.src))).toEqual([size, size]);
    }
    for (const size of [192, 512]) {
      const mask = icons.find((x) => x.sizes === `${size}x${size}` && x.purpose === 'maskable');
      expect(mask, `${size} maskable`).toBeTruthy();
      expect(pngSize(pub(mask!.src))).toEqual([size, size]);
    }
    // 디자인 세션 앱 아이콘('나'안, PR #47) — 임시 아이콘(public/icons)은 지움
    expect(icons.every((x) => x.src.startsWith('brand/'))).toBe(true);
    expect(existsSync(pub('icons'))).toBe(false);
  });

  it('index.html이 매니페스트 · 아이폰 홈 화면 아이콘(180px) · 브라우저 탭 아이콘(32·48px)을 가리킴', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
    expect(html).toContain('<link rel="manifest" href="./manifest.webmanifest" />');
    const apple = /<link rel="apple-touch-icon" href="\.\/([^"]+)" \/>/.exec(html);
    expect(apple).not.toBeNull();
    expect(pngSize(pub(apple![1]!))).toEqual([180, 180]);
    for (const size of [32, 48]) {
      const fav = new RegExp(`<link rel="icon" type="image/png" sizes="${size}x${size}" href="\\./([^"]+)" />`).exec(html);
      expect(fav, `파비콘 ${size}`).not.toBeNull();
      expect(pngSize(pub(fav![1]!))).toEqual([size, size]);
    }
  });
});

describe('F5-AC2: 서비스 워커', () => {
  it('fetch 처리기가 있음(크롬 자동 설치 창 조건) — 화면 이동만 받고, 안 되면 저장해 둔 화면', () => {
    expect(existsSync(pub('sw.js'))).toBe(true);
    const sw = readFileSync(pub('sw.js'), 'utf8');
    expect(sw).toMatch(/addEventListener\('fetch'/);
    expect(sw).toMatch(/respondWith\(/);
    expect(sw).toMatch(/\.mode [!=]== 'navigate'/);
  });

  it('github.io에서만 등록(내 컴퓨터·화면 테스트에서는 등록하지 않음)', () => {
    expect(shouldRegisterSw('lucubrate1231.github.io')).toBe(true);
    expect(shouldRegisterSw('localhost')).toBe(false);
    expect(shouldRegisterSw('127.0.0.1')).toBe(false);
  });
});

describe('D33 ①: 카카오톡 → 바깥 브라우저 주소', () => {
  const target = 'https://lucubrate1231.github.io/imamttae/next/?carry=s-1,s-2#/saved';

  it('카카오톡 바깥 브라우저로 열기(기본 브라우저)', () => {
    expect(kakaoExternalUrl(target)).toBe(`kakaotalk://web/openExternal?url=${encodeURIComponent(target)}`);
  });

  it('안드로이드 intent 주소(크롬을 콕 집음), 크롬이 없으면 같은 주소를 기본 브라우저로', () => {
    expect(chromeIntentUrl(target)).toBe(
      `intent://lucubrate1231.github.io/imamttae/next/?carry=s-1,s-2#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(target)};end`,
    );
  });
});

describe('D33 ②: 넘길 때 저장한 장면 번호를 주소에 붙이고 받기(장면 번호뿐)', () => {
  it('붙이기: carry=번호,번호 — 이미 있는 주소 꼬리표와 # 뒤는 그대로', () => {
    expect(withCarry('https://x.io/imamttae/next/?from=share#/scene/s-1', ['s-1', 's-2'])).toBe('https://x.io/imamttae/next/?from=share&carry=s-1%2Cs-2#/scene/s-1');
    expect(withCarry('https://x.io/a/', [])).toBe('https://x.io/a/');
  });

  it('받기: 장면 번호 모양만 받고(이상한 값은 버림), 너무 많으면 앞에서 100개', () => {
    expect(readCarry('?carry=s-020-naejangsan-uhwajeong%2Cs-005-biryong')).toEqual(['s-020-naejangsan-uhwajeong', 's-005-biryong']);
    expect(readCarry('?carry=s-1,<script>,s-1,,p-ready')).toEqual(['s-1', 'p-ready']);
    expect(readCarry('?from=share')).toEqual([]);
    const many = Array.from({ length: 150 }, (_, i) => `s-${i}`).join(',');
    expect(readCarry(`?carry=${many}`)).toHaveLength(100);
  });
});
