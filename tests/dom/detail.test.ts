// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startApp, type AppDeps } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import { HOME_SCENES, placeholder, story } from '../fixtures/homeScenes';
import type { ContentFile } from '../../shared/schema/content';

/** 장면 상세(F2) — docs/features/F2-장면-카드와-길찾기.md, 확정 시안 v2 */
const OCT = new Date('2026-09-30T16:00:00Z');
const PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36';
const PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36';

const photo = (n: number) => ({ src: `https://t1.daumcdn.net/brunch/service/user/p${n}.jpg`, cap: '', w: 1200, h: 800 });
const CONTENT: ContentFile = {
  ...HOME_SCENES,
  scenes: [
    ...HOME_SCENES.scenes,
    story('s-detail', {
      name: '남설악 주전골',
      region: '강원 양양',
      visited: '2022-10-15',
      types: ['danpung'],
      best: { from: 10, to: 10, note: '10월 중순~하순', tip: '맑은 날 오전' },
      oneLiner: '계곡을 따라 걷는 단풍길',
      excerpt: '용소폭포를 지나자 붉은 단풍이 계곡을 덮고 있었다.',
      photos: [photo(1), photo(2), photo(3)],
      review: { best: 'draft', dest: 'confirmed', oneLiner: 'draft', types: 'confirmed' },
      dest: { name: '오색약수터주차장', lat: 38.0774, lng: 128.4526, kind: 'parking' },
      brunchUrl: 'https://brunch.co.kr/@caed5ea4c3d74d9/5',
    }),
    placeholder('p-ready', '부산 태종대', '2023-10-26'),
  ],
};

let root: HTMLElement;
let opened: string[];
async function start(hash: string, o: Partial<AppDeps> = {}) {
  window.location.hash = hash;
  return startApp({ root, map: createListMap(), content: CONTENT, now: OCT, ua: PHONE, openUrl: (u) => opened.push(u), ...o });
}
const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const text = (sel: string) => q(sel)?.textContent ?? '';
const hashChange = () => window.dispatchEvent(new Event('hashchange'));

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = '';
  root = document.getElementById('app')!;
  opened = [];
});
afterEach(() => vi.useRealTimers());

describe('열고 닫기', () => {
  it('F2-AC1: #/scene/… 주소로 열리고, 뒤로 버튼을 누르면 첫 화면으로', async () => {
    await start('#/scene/s-detail');
    expect(q('.detail')!.classList.contains('open') || q('.detail')!.getAttribute('aria-hidden') === 'false').toBe(true);
    expect(text('.detail .title')).toBe('남설악 주전골');
    q('.detail .back')!.click();
    hashChange();
    expect(q('.detail')!.getAttribute('aria-hidden')).toBe('true');
  });

  it('없는 장면 주소면 상세를 열지 않음', async () => {
    await start('#/scene/s-none');
    expect(q('.detail')!.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('내용', () => {
  it('F2-AC2: 구역 순서는 제목 → 추천 시기 → 작가의 한마디 → 브런치 전체 이야기(10/4 결정)', async () => {
    await start('#/scene/s-detail');
    const secs = [...root.querySelectorAll(".detail .body > .dsec")].map((s) => s.getAttribute("aria-label"));
    expect(secs).toEqual(['제목', '추천 시기', '작가의 한마디', '브런치 전체 이야기']);
    expect(text('.detail .region')).toBe('강원 양양');
    expect(text('.detail .one')).toContain('계곡을 따라 걷는 단풍길');
    expect(text('.detail .quote p')).toBe('용소폭포를 지나자 붉은 단풍이 계곡을 덮고 있었다.');
    expect(text('.detail .quote cite')).toBe('2022년 10월 15일');
    expect(q<HTMLAnchorElement>('.detail .btn.line')!.href).toBe('https://brunch.co.kr/@caed5ea4c3d74d9/5');
    expect(root.querySelector('.detail')!.textContent).not.toContain('가는 곳');
  });

  it('꼬리표는 오늘(한국 날짜) 기준: 오늘이 추천 시기 안이면 [지금 제철] + 풍경 종류(10/4 결정)', async () => {
    await start('#/scene/s-detail');
    expect([...root.querySelectorAll('.detail .body .badges .badge')].map((b) => b.textContent)).toEqual(['지금 제철', '단풍·은행']);
    expect(q('.detail .when-off')).toBeNull();
  });

  it('철이 아니면 풍경 종류만, 추천 시기 칸 맨 위에 "지금은 철이 아니에요 · N월부터"', async () => {
    await start('#/scene/s-sanggodae');
    expect([...root.querySelectorAll('.detail .body .badges .badge')].map((b) => b.textContent)).toEqual(['설경·상고대']);
    const box = q('.detail .when-box')!;
    expect(box.firstElementChild!.textContent).toBe('지금은 철이 아니에요 · 1월부터');
  });

  it('일 년 내내 볼 수 있는 곳은 [일 년 내내] + 풍경 종류', async () => {
    await start('#/scene/s-sea');
    expect([...root.querySelectorAll('.detail .body .badges .badge')].map((b) => b.textContent)).toEqual(['일 년 내내', '바다 절경']);
    expect(q('.detail .when-off')).toBeNull();
  });

  it('첫 화면에서 다른 달을 골라 둬도 꼬리표 기준은 오늘', async () => {
    await start('#/month/1');
    window.location.hash = '#/scene/s-detail';
    hashChange();
    expect(text('.detail .body .badges')).toContain('지금 제철');
  });

  it('F2-AC2b: 사진 장 수만큼 점, 첫 장에서는 왼쪽 화살표 숨김, 사진 위에는 뒤로·넘김·크레딧만', async () => {
    await start('#/scene/s-detail');
    expect(root.querySelectorAll('.detail .gdots i')).toHaveLength(3);
    expect(q('.detail .prev')!.hidden).toBe(true);
    expect(q('.detail .next')!.hidden).toBe(false);
    expect(q('.detail .gallery')!.classList.contains('ov-wait')).toBe(true); // 들어오자마자 뜨지 않음
    expect(text('.detail .credit')).toContain('사진·글 이상호');
  });

  it('F2-AC4: 작가가 아직 확인하지 않은 추천 시기·한 줄 소개에는 "초안"', async () => {
    await start('#/scene/s-detail');
    expect(text('.detail .one .draft')).toBe('초안');
    expect(text('.detail .when-row .draft')).toBe('초안');
  });

  it('F2-AC12: 추천 시기 칸 — 추천 시기, 이럴 때 더 좋아요, 해마다 달라짐 안내, 올해 소식 찾아보기', async () => {
    await start('#/scene/s-detail');
    expect(text('.detail .when-row')).toContain('10월 중순~하순');
    expect(text('.detail .when-tip')).toContain('맑은 날 오전');
    expect(text('.detail .when-vary')).toContain('단풍 드는 때는 해마다');
    expect(text('.detail .when-link')).toBe('올해 단풍지도 찾아보기 ›');
  });

  it('F2-AC13: 사진 안내 "사진은 작가 부부가 N월에 다녀온 모습이에요"는 모든 장면에, "작가 부부 방문" 꼬리표는 없음', async () => {
    await start('#/scene/s-sea');
    expect(text('.detail .recnote')).toBe('사진은 작가 부부가 10월에 다녀온 모습이에요.');
    expect(text('.detail .body .badges')).not.toContain('작가 부부 방문');
    window.location.hash = '#/scene/s-detail';
    hashChange();
    expect(text('.detail .recnote')).toBe('사진은 작가 부부가 10월에 다녀온 모습이에요.');
  });

  it('F2-AC8: 준비 중 장면은 이름·다녀온 날·안내만. 사진·본문·길찾기 없음', async () => {
    await start('#/scene/p-ready');
    expect(text('.detail .title')).toBe('부산 태종대');
    expect(root.querySelector('.detail')!.textContent).toContain('2023년 10월 26일');
    expect(root.querySelector('.detail')!.textContent).toContain('작가가 글을 다듬고 있어요. 브런치에 발행되면 여기에 이야기가 채워져요');
    expect(q('.detail img')).toBeNull();
    expect(q('.detail .dbar')).toBeNull();
  });

  it('F2-AC10: 사진을 못 불러오면 회색 자리와 "사진은 브런치에서 볼 수 있어요"', async () => {
    await start('#/scene/s-detail');
    q('.detail .slide img')!.dispatchEvent(new Event('error'));
    expect(text('.detail .slide')).toContain('사진은 브런치에서 볼 수 있어요');
  });
});

describe('아래 붙박이 막대', () => {
  it('F2-AC2c: 가고 싶어요 → 담았어요(다시 누르면 뺌), 상세를 다시 열어도 그대로', async () => {
    await start('#/scene/s-detail');
    const want = () => q('.detail .dact')!;
    expect(want().getAttribute('aria-pressed')).toBe('false');
    want().click();
    expect(want().getAttribute('aria-pressed')).toBe('true');
    expect(want().textContent).toContain('담았어요');
    expect(text('.toast')).toBe('가고 싶은 곳에 담았어요');
    window.location.hash = '#/month/10';
    hashChange();
    window.location.hash = '#/scene/s-detail';
    hashChange();
    expect(want().getAttribute('aria-pressed')).toBe('true');
    want().click();
    expect(want().getAttribute('aria-pressed')).toBe('false');
  });

  it('F2-AC9: 공유 창이 없는 브라우저에서는 주소를 복사하고 알림', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await start('#/scene/s-detail');
    [...root.querySelectorAll<HTMLButtonElement>('.detail .dact')].find((b) => b.textContent?.includes('공유'))!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#/scene/s-detail')));
    await vi.waitFor(() => expect(text('.toast')).toBe('주소를 복사했어요'));
  });

  it('F2-AC5: 버튼은 "길찾기(티맵)", 누르면 티맵이 좌표(주차장)로 바로 열림', async () => {
    await start('#/scene/s-detail');
    expect(text('.detail .go')).toBe('길찾기(티맵)');
    q('.detail .go')!.click();
    const u = new URL(opened[0]!);
    expect(u.protocol).toBe('tmap:');
    expect(u.searchParams.get('rGoX')).toBe('128.4526');
    expect(u.searchParams.get('rGoY')).toBe('38.0774');
  });

  it('F2-AC5: 티맵이 열리지 않으면(1.5초 뒤에도 화면 그대로) "티맵 설치 / 네이버지도 / 카카오맵" 안내', async () => {
    vi.useFakeTimers();
    await start('#/scene/s-detail');
    q('.detail .go')!.click();
    vi.advanceTimersByTime(1600);
    expect(opened).toHaveLength(1); // 다른 앱을 마음대로 열지 않음
    const sheet = q('.navi-sheet')!;
    expect(sheet.hidden).toBe(false);
    expect([...sheet.querySelectorAll('button, a')].map((b) => b.textContent)).toEqual(['티맵 설치', '네이버지도', '카카오맵', '닫기']);
  });

  it('F2-AC5: 티맵이 열려 화면이 가려지면 안내를 띄우지 않음', async () => {
    vi.useFakeTimers();
    await start('#/scene/s-detail');
    q('.detail .go')!.click();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(1600);
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    expect(q('.navi-sheet')?.hidden ?? true).toBe(true);
  });

  it('F2-AC5: 작게 "다른 앱으로 길찾기" → 네이버지도를 고르면 열고 기억, 다음부터 버튼이 "길찾기(네이버지도)"', async () => {
    const mem = new Map<string, unknown>();
    const store = { available: true, get: <T,>(k: string, d: T) => (mem.has(k) ? (mem.get(k) as T) : d), set: (k: string, v: unknown) => (mem.set(k, v), true) };
    await start('#/scene/s-detail', { store });
    q('.detail .navi-other')!.click();
    const naver = [...q('.navi-sheet')!.querySelectorAll<HTMLElement>('button')].find((b) => b.textContent === '네이버지도')!;
    naver.click();
    expect(new URL(opened[0]!).protocol).toBe('nmap:');
    expect(mem.get('navi')).toBe('naver');
    window.location.hash = '#/scene/s-sea';
    hashChange();
    expect(text('.detail .go')).toBe('길찾기(네이버지도)');
  });

  it('F2-AC7: 컴퓨터에서는 바로 카카오맵 웹', async () => {
    await start('#/scene/s-detail', { ua: PC });
    q('.detail .go')!.click();
    expect(opened[0]).toMatch(/^https:\/\/map\.kakao\.com\/link\/to\//);
  });
});
