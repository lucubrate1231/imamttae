// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { startApp, type AppDeps } from '../../src/app';
import type { EventData, Tracker } from '../../src/analytics';
import { createListMap } from '../../src/map/listMap';
import { HOME_SCENES } from '../fixtures/homeScenes';

/** 출시 준비 화면(D45·D46, 디자인 #107) — design-guide 12장, 글자 10-8 */
const OCT = new Date('2026-09-30T16:00:00Z');
const FORM = 'https://forms.gle/TESTSHORT'; // 카드용(짧은 주소)
const PREFILL = 'https://docs.google.com/forms/d/e/TESTFORM/viewform'; // 장면 상세용(미리 채운 링크의 바탕 주소)
let root: HTMLElement;
let events: [string, EventData | undefined][];
const tracker: Tracker = { load() {}, pageview() {}, track: (n, d) => void events.push([n, d]) };
let toasts: string[];

async function start(hash: string, o: Partial<AppDeps> = {}) {
  window.location.hash = hash;
  return startApp({ root, map: createListMap(), content: HOME_SCENES, now: OCT, tracker, feedbackUrl: FORM, feedbackPrefillUrl: PREFILL, feedbackPlaceField: 'entry.1234', contactEmail: 'hello@example.com', ...o });
}
const q = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
const hashChange = () => window.dispatchEvent(new Event('hashchange'));
const go = (hash: string) => {
  window.location.hash = hash;
  hashChange();
};

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  root = document.getElementById('app')!;
  events = [];
  toasts = [];
  localStorage.clear();
});

describe('의견 보내기(D46, 12-1) — 세 자리', () => {
  it('첫 화면: "이 앱 이야기" 바로 아래 카드 — 새 창으로 폼, 읽기 "의견 보내기, 새 창", 그 아래 바닥줄 "이용 안내 · 개인정보"(10/7)', async () => {
    await start('#/month/10');
    const extra = q('main.home .extra')!;
    const card = extra.querySelector<HTMLAnchorElement>('a.feedback')!;
    expect(card.previousElementSibling!.matches('.story-link')).toBe(true);
    expect(card.getAttribute('href')).toBe(FORM);
    expect(card.getAttribute('target')).toBe('_blank');
    expect(card.getAttribute('aria-label')).toBe('의견 보내기, 새 창');
    expect(card.querySelector('b')!.textContent).toBe('의견 보내기');
    expect(card.querySelector('.fb-sub')!.textContent).toBe('불편한 점, 틀린 정보, 바라는 점 무엇이든 좋아요.');
    const foot = card.nextElementSibling as HTMLAnchorElement;
    expect(foot.matches('a.privacy-link')).toBe(true);
    expect(foot.textContent).toBe('이용 안내 · 개인정보');
    expect(foot.getAttribute('href')).toBe('#/privacy');
    card.click();
    expect(events).toContainEqual(['feedback', { where: 'home' }]);
  });

  it('저장한 곳: 맨 아래 설치 카드 아래 같은 카드, "이 휴대폰에만 저장돼요" 상자 끝 "개인정보 안내 보기 ›" → 개인정보 구역', async () => {
    await start('#/saved');
    const foot = q('.saved .sv-foot')!;
    const card = foot.querySelector<HTMLAnchorElement>('a.feedback')!;
    expect(card.previousElementSibling!.matches('.home-add')).toBe(true);
    card.click();
    expect(events).toContainEqual(['feedback', { where: 'saved' }]);
    const link = foot.querySelector<HTMLAnchorElement>('.sv-note a.privacy-more')!;
    expect(link.textContent).toBe('개인정보 안내 보기 ›');
    expect(link.getAttribute('href')).toBe('#/privacy/personal');
  });

  it('장면 상세: 본문 끝 "다른 앱으로 길찾기" 아래 줄 "이곳 정보가 달라졌나요?" — 폼의 어느 곳 칸에 장면 이름을 미리 넣음', async () => {
    await start('#/scene/s-naejang', { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36' });
    const line = q<HTMLAnchorElement>('.detail.open a.fb-line')!;
    expect(line.previousElementSibling!.matches('.safety')).toBe(true); // 안전 안내(10/7) 바로 아래
    expect(line.querySelector('b')!.textContent).toBe('이곳 정보가 달라졌나요?');
    expect(line.querySelector('.fb-sub')!.textContent).toBe('주차·길·입장 등 알려 주시면 고칠게요');
    expect(line.getAttribute('aria-label')).toBe('이곳 정보가 달라졌나요? 알려 주기, 새 창');
    const u = new URL(line.href);
    expect(u.origin + u.pathname).toBe(PREFILL);
    expect(u.searchParams.get('usp')).toBe('pp_url');
    expect(u.searchParams.get('entry.1234')).toBe('내장산 우화정');
    line.click();
    expect(events).toContainEqual(['feedback', { where: 'detail', scene: 's-naejang' }]);
  });

  it('칸 번호나 미리 채운 링크를 모르면 장면 이름 없이 카드와 같은 폼(짧은 주소에는 이름을 붙이지 않음)', async () => {
    await start('#/scene/s-naejang', { feedbackPlaceField: '' });
    expect(q<HTMLAnchorElement>('.detail.open a.fb-line')!.getAttribute('href')).toBe(FORM);
    document.body.innerHTML = '<div id="app"></div>';
    root = document.getElementById('app')!;
    await start('#/scene/s-naejang', { feedbackPrefillUrl: '' });
    expect(q<HTMLAnchorElement>('.detail.open a.fb-line')!.getAttribute('href')).toBe(FORM);
  });

  it('장소 이름은 주소용 글자로 바꿔 넣음(한글·띄어쓰기·· 등)', async () => {
    await start('#/scene/s-naejang');
    const href = q<HTMLAnchorElement>('.detail.open a.fb-line')!.getAttribute('href')!;
    expect(href).toContain('entry.1234=%EB%82%B4%EC%9E%A5%EC%82%B0'); // '내장산'
    expect(href).not.toMatch(/[가-힣 ]/);
  });

  it('폼 주소가 비어 있으면 세 자리 모두 감춤(기획 10/6 — 주소를 받기 전)', async () => {
    await start('#/month/10', { feedbackUrl: '' });
    expect(q<HTMLElement>('main.home a.feedback')!.hidden).toBe(true);
    go('#/saved');
    expect(q<HTMLElement>('.saved a.feedback')!.hidden).toBe(true);
    go('#/scene/s-naejang');
    expect(q<HTMLElement>('.detail.open a.fb-line')!.hidden).toBe(true);
  });

  it('문의 이메일은 설정 한 곳(src/config.ts)의 앱 전용 주소(D48)', async () => {
    await start('#/privacy', { contactEmail: undefined });
    expect(q('.privacy .pv-mail')!.textContent).toBe('imamttae.sight@gmail.com');
    expect(q<HTMLAnchorElement>('.privacy .pv-contact a.btn')!.getAttribute('href')).toBe('mailto:imamttae.sight@gmail.com');
  });

  it('홈 화면 아이콘으로 열어도 보임(설치 카드와 달리 숨기지 않음)', async () => {
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    await start('#/month/10');
    expect(q<HTMLElement>('main.home a.feedback')!.hidden).toBe(false);
    Object.defineProperty(navigator, 'standalone', { value: false, configurable: true });
  });
});

describe('안전 안내(10/7, C-12 · design-guide 12-3)', () => {
  const SAFE = '정보는 작가가 다녀온 때를 기준으로 해요. 길·주차·출입 통제는 떠나기 전에 현장 안내를 확인하시고, 날씨와 몸 상태에 맞게 무리하지 마세요.';
  it('모든 장면 본문 끝, 브런치 버튼 아래 · "이곳 정보가 달라졌나요?" 바로 위 — ⓘ는 장식 · "다른 앱으로 길찾기"는 그 뒤 맨 끝(D67)', async () => {
    await start('#/scene/s-naejang', { ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36' });
    const safe = q('.detail.open .safety')!;
    expect(safe.textContent).toBe(SAFE);
    expect(safe.querySelector('.info')!.getAttribute('aria-hidden')).toBe('true');
    expect(safe.previousElementSibling!.getAttribute('aria-label')).toBe('브런치 전체 이야기');
    expect(safe.nextElementSibling!.matches('a.fb-line')).toBe(true);
    const body = q('.detail.open .body')!;
    expect(body.lastElementChild!.matches('.navi-row')).toBe(true); // D67: 맨 끝(아래 막대 [길찾기] 바로 위)
    expect(body.lastElementChild!.previousElementSibling!.matches('a.fb-line')).toBe(true);
    expect(root.querySelectorAll('.detail.open .precheck .safety')).toHaveLength(0); // '떠나기 전에 확인하세요' 카드에는 넣지 않음
  });

  it('의견 보내기를 감춰도(폼 주소가 비어도) 안전 안내는 그대로', async () => {
    await start('#/scene/s-naejang', { feedbackUrl: '' });
    expect(q('.detail.open .safety')!.hidden).toBe(false);
  });

  it('모든 이야기 장면에 같은 안내(준비 중 글·숨긴 장면은 상세가 없음)', async () => {
    await start('#/month/10');
    for (const s of HOME_SCENES.scenes.filter((x) => x.kind === 'story' && !x.hidden)) {
      go(`#/scene/${s.id}`);
      expect(q('.detail.open .safety')?.textContent, s.id).toBe(SAFE);
    }
  });
});

describe('이용 안내와 개인정보(#/privacy, 12-2 — 글 10/7)', () => {
  it('바닥줄을 누르면 화면이 열림 — ‹ 뒤로 · 제목 · 구역 둘(이 앱의 정보는 · 개인정보) · 소제목 여섯 · 문의 상자 · 맨 아래 운영, 아래 메뉴는 어느 칸도 고르지 않음', async () => {
    await start('#/month/10');
    go('#/privacy');
    const p = q('.privacy')!;
    expect(p.hidden).toBe(false);
    expect(q<HTMLElement>('main.home')!.hidden).toBe(true);
    expect(p.querySelector('.pv-back')!.textContent).toBe('‹ 뒤로');
    expect(p.querySelector('.pv-back')!.getAttribute('aria-label')).toBe('뒤로');
    expect(p.querySelector('h1')!.textContent).toBe('이용 안내와 개인정보');
    expect([...p.querySelectorAll('h2.pv-zone')].map((h) => h.textContent)).toEqual(['이 앱의 정보는', '개인정보']);
    expect([...p.querySelectorAll('#pv-info li')].map((l) => l.textContent)).toEqual([
      '장소·추천 시기·주차 안내는 이상호 작가가 다녀온 때의 기록이에요. 그 뒤로 길이 막히거나 주차장이 바뀌었을 수 있어요.',
      '떠나기 전에 국립공원·지자체의 현장 안내와 날씨를 확인하세요.',
      '출입 통제 구역이나 정해진 길이 아닌 곳에는 들어가지 마세요.',
      '산길·물가·눈길은 날씨와 몸 상태에 맞게, 무리하지 마세요.',
      "길찾기는 고른 지도 앱이 안내해요. 실제와 다르면 장소 화면 맨 아래 '이곳 정보가 달라졌나요?'로 알려 주세요.",
      '이 앱은 갈 곳을 고르는 데 도움을 드리는 안내예요. 현장 상황과 안전은 직접 확인해 주세요.',
    ]);
    expect(p.querySelector('#pv-personal .pv-lead')!.textContent).toBe('이맘때 풍경은 로그인 없이 쓰는 무료 앱이에요. 이름·연락처 같은 개인정보를 받지 않고, 쓰시는 기록은 이 휴대폰에만 둬요.');
    expect([...p.querySelectorAll('#pv-personal h3.pv-h')].map((h) => h.textContent)).toEqual(['받지 않는 것', '이 휴대폰에만 두는 것', '방문 통계', '함께 쓰는 서비스', '의견과 문의', '저장한 것 지우는 법']);
    expect(p.querySelector('.pv-contact h3')!.textContent).toBe('문의');
    expect(p.querySelector('.pv-mail')!.textContent).toBe('hello@example.com');
    expect(p.querySelector<HTMLAnchorElement>('.pv-contact a.btn')!.getAttribute('href')).toBe('mailto:hello@example.com');
    expect(p.querySelector('.pv-date')!.textContent).toMatch(/^운영: 이맘때 풍경/);
    expect(root.querySelectorAll('.tabs [aria-current]')).toHaveLength(0);
  });

  it('글은 디자인 10-8 표 그대로(점 목록과 문단)', async () => {
    await start('#/privacy');
    const sec = (t: string) => [...root.querySelectorAll<HTMLElement>('.pv-sec')].find((x) => x.querySelector('h3')!.textContent === t)!;
    const items = (t: string) => [...sec(t).querySelectorAll('li')].map((l) => l.textContent);
    const paras = (t: string) => [...sec(t).querySelectorAll('p')].map((l) => l.textContent);
    expect(items('받지 않는 것')).toEqual(['이름, 전화번호, 이메일, 로그인 정보', '내 위치 — 앱이 위치를 묻지 않아요']);
    expect(items('이 휴대폰에만 두는 것')).toEqual(['저장한 곳, 다녀온 곳과 그 날짜', '처음 연 달, 고른 길찾기 앱, 안내를 닫은 기록, 어떤 초대 주소로 들어왔는지', '인터넷이 끊겨도 열리게 하는 앱 화면 사본 — 개인 기록은 아니에요']);
    expect(paras('이 휴대폰에만 두는 것')).toEqual(['저희 쪽으로 보내지 않아요. 그래서 휴대폰을 바꾸거나 다른 앱(카톡·크롬)으로 열면 기록이 따로예요.']);
    expect(paras('방문 통계')).toEqual(['더 나은 앱을 만들려고 어느 화면을 열고 어떤 버튼을 눌렀는지 세어요(Umami). 쿠키를 쓰지 않고, 누구인지 알 수 있는 번호를 만들지 않아요. 휴대폰 종류와 대략의 지역 정도만 함께 남아요.']);
    expect(items('함께 쓰는 서비스')).toEqual([
      '지도는 카카오맵, 사진은 브런치(카카오), 글꼴은 구글, 앱을 올려 둔 곳은 GitHub예요.',
      '[길찾기]를 누르면 고른 앱(티맵·카카오맵·네이버지도)에 가는 곳만 넘겨요. 앱이 없으면 구글 플레이·앱 스토어의 설치 화면으로 연결해요.',
      "'찾아보기'는 구글 검색, '의견 보내기'는 구글 폼으로 열려요.",
    ]);
    expect(paras('함께 쓰는 서비스')).toEqual(['이 서비스들은 연결할 때 접속 정보(인터넷 주소 등)를 각자의 정책에 따라 처리해요.']);
    expect(items('의견과 문의')).toEqual([
      '의견 보내기(구글 폼)에는 적어 주신 내용만 남아요. 이름과 연락처는 적지 않으셔도 돼요.',
      '이메일로 문의하시면 답장을 위해 보내신 주소와 내용을 받아요. 답을 드린 뒤 1년 안에 지워요.',
    ]);
    expect(items('저장한 것 지우는 법')).toEqual([
      '저장한 곳은 장소 화면에서 [저장됨]을 다시 누르면 빠져요.',
      "다녀온 곳은 장소 화면의 [날짜 변경]에서 '다녀온 기록 지우기'를 누르세요.",
      '모두 지우려면 쓰시는 인터넷 앱(크롬·삼성 인터넷·사파리) 설정에서 인터넷 사용 기록과 사이트 데이터를 지우세요. 아이폰 홈 화면에 둔 앱은 아이콘을 지우면 기록도 지워져요.',
      '지운 기록은 되돌릴 수 없어요.',
    ]);
  });

  it('저장한 곳 링크(#/privacy/personal)로 열면 "개인정보" 구역 제목이 맨 위로', async () => {
    const seen: Element[] = [];
    const orig = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      seen.push(this);
    };
    await start('#/saved');
    go('#/privacy/personal');
    Element.prototype.scrollIntoView = orig;
    expect(q('.privacy')!.hidden).toBe(false);
    expect(seen.at(-1)).toBe(q('#pv-personal'));
  });

  it('‹ 뒤로: 앱 안에서 열었으면 전 화면으로, 주소로 바로 열었으면 첫 화면으로', async () => {
    await start('#/privacy');
    q<HTMLButtonElement>('.privacy .pv-back')!.click();
    expect(window.location.hash).toBe('#/');
  });
});
