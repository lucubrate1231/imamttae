// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp, type AppDeps } from '../../src/app';
import { createListMap } from '../../src/map/listMap';
import type { ContentFile } from '../../shared/schema/content';
import appData from '../../public/data/scenes.json';

/**
 * 풍경 찾기(F3) — docs/features/F3-풍경-찾기.md, design-guide 8장(A안 '사진 타일')
 * 실제 앱 데이터로 F3 문서의 10월 예시가 그대로 나오는지 봅니다. 숫자 대신 순서·묶음 규칙으로 확인합니다.
 */
const OCT = new Date('2026-10-03T03:00:00Z');
let root: HTMLElement;
async function start(hash: string, o: Partial<AppDeps> = {}) {
  window.location.hash = hash;
  return startApp({ root, map: createListMap(), findMap: createListMap(), content: appData as ContentFile, now: OCT, ...o });
}
const q = (sel: string) => root.querySelector<HTMLElement>(sel);
const all = (sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const names = (sel: string) => all(sel).map((e) => e.querySelector('.tile-name')?.textContent ?? '');
const hashChange = () => window.dispatchEvent(new Event('hashchange'));

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = '';
  root = document.getElementById('app')!;
});

describe('풍경 고르기(#/find)', () => {
  it('F3-AC1: 아래 메뉴 "풍경 찾기"를 누르면 고르기 화면, 첫 화면은 숨김', async () => {
    await start('#/month/10');
    all('.tabs button').find((b) => b.textContent === '풍경 찾기')!.click();
    expect(window.location.hash).toBe('#/find');
    hashChange();
    expect(q('.find')!.hidden).toBe(false);
    expect(q('main.home')!.hidden).toBe(true);
    expect(q('.tabs button[aria-current="page"]')!.textContent).toBe('풍경 찾기');
    expect(q('.find h1')!.textContent).toBe('어떤 풍경이 보고 싶으세요?');
  });

  it('F3-AC1·D22: 10월에 좋은 풍경 — 이번 달 장면이 많은 순, 첫째는 큰 타일(이름 위에 "지금 좋아요")', async () => {
    await start('#/find');
    expect(q('.sec-good h2')!.textContent).toBe('10월에 좋은 풍경');
    expect(names('.sec-good .tile')).toEqual(['단풍·은행', '운해·물안개', '억새·갈대', '계곡·폭포']);
    const big = q('.sec-good .tile')!;
    expect(big.classList.contains('big-tile')).toBe(true);
    const cap = big.querySelector('.tile-cap')!;
    expect(cap.firstElementChild!.textContent).toBe('지금 좋아요'); // 상태는 이름 위(8-1)
    expect(big.textContent).not.toContain('제철');
    expect(big.querySelector('.tile-line')!.textContent).toMatch(/^10~11월 · \d+곳$/);
  });

  it('D17: 언제나 볼 수 있는 풍경 — 일출·낙조, 바다 절경(한 줄은 "언제나 · N곳")', async () => {
    await start('#/find');
    expect(names('.sec-always .tile')).toEqual(['일출·낙조', '바다 절경']);
    expect(q('.sec-always .tile .tile-line')!.textContent).toMatch(/^언제나 · \d+곳$/);
  });

  it('D22: 다른 때 풍경 — 다음 달부터 가까운 순, 같으면 표 순서', async () => {
    await start('#/find');
    expect(names('.sec-other .tile')).toEqual(['설경·상고대', '매화·산수유', '벚꽃', '진달래·철쭉', '신록·초원', '여름꽃', '꽃무릇·가을꽃']);
    expect(all('.sec-other .tile')[0]!.querySelector('.tile-line')!.textContent).toMatch(/^11~2월 · /);
  });

  it('작은 타일이 홀수여도 가로 타일을 쓰지 않음 — 2열 그대로, 마지막 칸은 비움(8-1, 10/4 사용자)', async () => {
    await start('#/find');
    expect(root.querySelectorAll('.tile.wide')).toHaveLength(0);
  });

  it('F3-AC7: 지역으로 고르기 — 전국 + 장면이 있는 권역(장면 수), 누르면 그 권역 주소', async () => {
    await start('#/find');
    const chips = all('.sec-region .chip');
    expect(chips[0]!.textContent).toBe('전국');
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(chips.slice(1).map((c) => c.firstChild?.textContent)).toEqual(['강원', '경상', '전라', '충청', '수도권']);
    chips[1]!.click();
    expect(window.location.hash).toBe('#/find/all/gangwon');
  });

  it('타일을 누르면 그 풍경 화면(#/find/danpung)', async () => {
    await start('#/find');
    all('.sec-good .tile')[0]!.click();
    expect(window.location.hash).toBe('#/find/danpung');
  });
});

describe('풍경을 고른 뒤(#/find/<풍경>)', () => {
  it('F3-AC2: 제목 아래 볼 수 있는 때 한 줄 — ● 지금 좋아요 · 11월까지(D29)', async () => {
    await start('#/find/danpung');
    expect(q('.find h1')!.textContent).toBe('단풍·은행');
    const line = q('.when-line')!;
    expect(line.textContent).toBe('지금 좋아요 · 11월까지');
    expect(line.querySelector('.dot.now')).not.toBeNull();
  });

  it('F3-AC2: 곧(다음 달 시작) — ○ 곧 · 11~2월에 가장 좋아요 / 그 밖 — 점 없이 "3월에 가장 좋아요" / 언제나', async () => {
    await start('#/find/seolgyeong');
    expect(q('.when-line')!.textContent).toBe('곧 · 11~2월에 가장 좋아요');
    expect(q('.when-line .dot.soon')).not.toBeNull();
    window.location.hash = '#/find/maehwa';
    hashChange();
    expect(q('.when-line')!.textContent).toBe('3월에 가장 좋아요');
    expect(q('.when-line .dot')).toBeNull();
    window.location.hash = '#/find/bada';
    hashChange();
    expect(q('.when-line')!.textContent).toBe('언제나 좋아요');
  });

  it('F3-AC3·D23: 목록은 "지금 좋아요" 묶음이 먼저, 그 안에서는 추천 시기가 먼저 끝나는 곳 먼저(같으면 이름순)', async () => {
    await start('#/find/danpung');
    const g = q('.group')!;
    expect(g.querySelector('.group-head')!.textContent).toBe('지금 좋아요');
    const rows = [...g.querySelectorAll('.row')].map((r) => r.querySelector('.row-name')!.textContent!);
    expect(rows.indexOf('남설악 주전골')).toBeLessThan(rows.indexOf('내장산 우화정'));
    const metas = [...g.querySelectorAll('.row-meta')].map((m) => m.textContent!);
    expect(metas.every((m) => / · /.test(m))).toBe(true); // '지역 · 추천 시기'
  });

  it('F3-AC3: 첫 묶음만 펼치고, 나머지는 "N월에 좋은 곳 더 보기"로 엶', async () => {
    await start('#/find/unhae');
    const more = all('.more');
    expect(more.length).toBeGreaterThan(0); // 운해·물안개는 묶음이 여럿(실제 데이터)
    expect(more[0]!.textContent).toMatch(/^\d+월에 좋은 곳 더 보기/);
    const hiddenBefore = all('.group').filter((g) => g.hidden).length;
    more[0]!.click();
    expect(all('.group').filter((g) => g.hidden).length).toBe(hiddenBefore - 1);
  });

  it('아래 구역은 회색 점 + "작가가 다녀온 곳" + 설명 한 줄, 줄마다 "○월에 다녀온 모습"(D31)', async () => {
    await start('#/find/danpung');
    const rec = q('.find-records')!; // 단풍·은행에는 철 지나 다녀온 곳이 있음(실제 데이터)
    expect(rec).not.toBeNull();
    expect(rec.querySelector('h2')!.textContent).toBe('작가가 다녀온 곳');
    expect(rec.querySelector('h2 .dot.recdot')).not.toBeNull();
    expect(rec.querySelector('.sub')!.textContent).toBe('가장 좋은 때는 아니지만 다녀온 모습을 볼 수 있어요.');
    expect(rec.querySelector('.row-meta')!.textContent).toMatch(/ · \d+월에 다녀온 모습$/);
  });

  it('D8: 언제나 풍경의 일 년 내내 장면은 회색으로 낮추지 않음(작가 부부가 다녀온 곳에 넣지 않음)', async () => {
    await start('#/find/bada');
    expect(q('.find-records')).toBeNull();
    expect(all('.find-list .row').length).toBeGreaterThan(0);
  });

  it('F3-AC7: 그 풍경이 있는 권역 칩(전국 N 포함), 고르면 그 권역 장면만', async () => {
    await start('#/find/danpung');
    const chips = all('.find-chips .chip');
    expect(chips[0]!.textContent).toMatch(/^전국 \d+$/);
    const total = all('.find-list .row').length + all('.find-records .row').length;
    const gangwon = chips.find((c) => c.textContent!.startsWith('강원'))!;
    const n = Number(gangwon.textContent!.replace(/\D/g, ''));
    gangwon.click();
    expect(window.location.hash).toBe('#/find/danpung/gangwon');
    hashChange();
    expect(all('.find-list .row').length + all('.find-records .row').length).toBe(n);
    expect(n).toBeLessThan(total);
  });

  it('F3-AC9: 제철 장면이 없는 풍경(억새·갈대) — 안내와 "지금 함께 보기 좋은 풍경" 타일 2개, 범례 없음', async () => {
    await start('#/find/eoksae');
    expect(q('.few-note')!.textContent).toBe('억새가 가장 좋을 때 다녀온 이야기는 아직 없어요. 다른 계절에 다녀온 모습이에요.');
    expect(names('.together .tile')).toEqual(['단풍·은행', '운해·물안개']);
    expect(q('.find .legend')).toBeNull();
  });

  it('풍경 화면 지도에는 범례를 두지 않음 — 색 구분만(D31)', async () => {
    await start('#/find/danpung');
    expect(q('.find .legend')).toBeNull();
  });

  it('F3-AC6: "‹ 풍경 찾기"를 누르면 고르기 화면으로', async () => {
    await start('#/find/danpung');
    q('.find-back')!.click();
    expect(window.location.hash).toBe('#/find');
  });

  it('목록 줄을 누르면 장면 상세', async () => {
    await start('#/find/danpung');
    q('.find-list .row')!.click();
    expect(window.location.hash).toMatch(/^#\/scene\//);
  });
});

describe('대표 사진', () => {
  it('풍경 타일의 사진 = 그 풍경 화면 목록 맨 위 장면의 사진(누르면 같은 사진이 맨 위에)', async () => {
    await start('#/find');
    const tileSrc = all('.sec-good .tile')[0]!.querySelector('img')!.getAttribute('src')!;
    window.location.hash = '#/find/danpung';
    hashChange();
    const rowSrc = q('.find-list .row img')!.getAttribute('src')!;
    const file = (u: string) => decodeURIComponent(u).split('/').pop();
    expect(file(tileSrc)).toBe(file(rowSrc));
  });
});
