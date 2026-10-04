/**
 * 홈 화면에 추가(F5)·D33 실기기 확인 페이지 (_review/a2hs-lab.html)
 * 사용자가 휴대폰(카카오톡 안·크롬·삼성 인터넷·설치한 앱)에서 열어 버튼을 누르고, [결과 복사]로 Claude에게 보내 줍니다.
 * 확인할 것(D33): ① 카톡 → 바깥 브라우저 두 방법 ② 저장한 장면 번호 넘기기, 크롬 탭과 설치한 앱이 저장을 함께 쓰는지
 *                 ③ 크롬 설치 창(beforeinstallprompt) ④ 삼성 인터넷 설치 창 신호
 */
import './a2hsLab.css';
import { launchMode } from '../analytics';
import { chromeIntentUrl, kakaoExternalUrl, readCarry, withCarry } from '../pwa';
import { createSafeStore } from '../storage/safeStorage';
import { createSavedStore } from '../storage/saved';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

const win = window;
const ua = navigator.userAgent;
const log: string[] = [];
const t0 = performance.now();
let installEvent: InstallEvent | null = null;
let swState = '확인 중';
const note = (msg: string) => {
  log.push(`${((performance.now() - t0) / 1000).toFixed(1)}초 ${msg}`);
  paint();
};

win.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // 우리 버튼으로 띄움
  installEvent = e as InstallEvent;
  note('설치 창 신호(beforeinstallprompt) 받음');
});
win.addEventListener('appinstalled', () => note('설치됨(appinstalled)'));

// 앱과 같은 저장소 — 크롬 탭과 설치한 앱이 함께 쓰는지(②)
const store = createSafeStore();
const saved = createSavedStore(store);
const MARK = 'lab-mark';
type Mark = { where: string; at: string } | null;
const where = () => launchMode(win);

function browserName(): string {
  const sam = /SamsungBrowser\/([\d.]+)/.exec(ua);
  if (sam) return `삼성 인터넷 ${sam[1]}`;
  if (/KAKAOTALK/i.test(ua)) return '카카오톡 안 화면';
  const cr = /(?:Chrome|CriOS)\/(\d+)/.exec(ua);
  if (cr) return `크롬 ${cr[1]}`;
  if (/Safari\//.test(ua)) return '사파리';
  return '모름';
}
const os = /Android/i.test(ua) ? '안드로이드' : /iPhone|iPad/i.test(ua) ? '아이폰' : 'PC';

/** 이 페이지로 다시 오는 주소 + 이 브라우저의 저장한 장면 번호 */
const target = () => withCarry(`${location.origin}${location.pathname}`, saved.wanted());

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  for (const k of kids) if (k !== null && k !== false) el.append(k);
  return el;
}
const row = (k: string, v: string) => h('div', { class: 'row' }, h('span', { class: 'k' }, k), h('b', {}, v));

function summary(): string {
  const mark = store.get<Mark>(MARK, null);
  return [
    '[설치 실기기 확인 결과]',
    `휴대폰: ${os} · ${browserName()} · 열린 방식 ${where()}`,
    `서비스 워커: ${swState}`,
    `설치 창 신호: ${installEvent ? '받음' : '아직 없음'}`,
    `이 브라우저 저장한 곳: ${saved.wanted().join(', ') || '없음'} (저장 ${saved.saved ? '됨' : '막힘'})`,
    `주소로 받은 장면 번호: ${readCarry(location.search).join(', ') || '없음'}`,
    `실험 표시: ${mark ? `${mark.where}에서 ${mark.at}에 남김` : '없음'}`,
    `브라우저 이름표: ${ua}`,
    ...log,
  ].join('\n');
}

const app = document.getElementById('app')!;
function paint(): void {
  const mark = store.get<Mark>(MARK, null);
  const carry = readCarry(location.search);

  const openExt = h('a', { class: 'btn', href: kakaoExternalUrl(target()) }, '① 카톡 → 기본 브라우저로 열기');
  const intent = h('a', { class: 'btn', href: chromeIntentUrl(target()) }, '① 카톡 → 크롬으로 열기(intent)');
  openExt.addEventListener('click', () => log.push('openExternal 누름'));
  intent.addEventListener('click', () => log.push('intent 누름'));

  const merge = h('button', { type: 'button', class: 'btn' }, `② 받은 ${carry.length}곳을 저장한 곳에 합치기`);
  merge.toggleAttribute('disabled', !carry.length);
  merge.addEventListener('click', () => {
    let n = 0;
    for (const id of carry) {
      if (saved.isWanted(id)) continue;
      saved.toggleWanted(id);
      n++;
    }
    note(`받은 장면 합침: 새로 ${n}곳`);
  });
  const markBtn = h('button', { type: 'button', class: 'btn' }, '② 이 브라우저에 실험 표시 남기기');
  markBtn.addEventListener('click', () => {
    store.set(MARK, { where: where(), at: new Date().toLocaleTimeString('ko-KR') });
    note(`실험 표시 남김(${where()})`);
  });

  const install = h('button', { type: 'button', class: 'btn fill' }, installEvent ? '③ 설치 창 띄우기' : '③ 설치 창 신호를 기다리는 중…');
  install.toggleAttribute('disabled', !installEvent);
  install.addEventListener('click', async () => {
    if (!installEvent) return;
    const ev = installEvent;
    installEvent = null;
    await ev.prompt();
    note(`설치 창에서 고름: ${(await ev.userChoice).outcome}`);
  });

  const pre = h('pre', { class: 'sum' }, summary());
  pre.hidden = true;
  const copy = h('button', { type: 'button', class: 'btn fill' }, '결과 복사(카톡으로 보내 주세요)');
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(summary());
      copy.textContent = '복사했어요';
    } catch {
      pre.hidden = false; // 복사가 막히면 글을 길게 눌러 복사
      copy.textContent = '아래 글을 길게 눌러 복사해 주세요';
    }
  });

  app.replaceChildren(
    h('h1', {}, '설치 실기기 확인'),
    h('p', { class: 'lead' }, '버튼을 위에서부터 눌러 보고, 맨 아래 [결과 복사]를 눌러 Claude에게 보내 주세요.'),
    h(
      'section',
      { class: 'state', 'aria-label': '지금 상태' },
      row('휴대폰', `${os} · ${browserName()}`),
      row('열린 방식', where()),
      row('서비스 워커', swState),
      row('설치 창 신호', installEvent ? '받음' : '아직 없음'),
      row('저장한 곳', `${saved.wanted().length}곳${saved.saved ? '' : ' (저장 막힘)'}`),
      row('주소로 받은 장면', carry.length ? `${carry.length}곳` : '없음'),
      row('실험 표시', mark ? `${mark.where} · ${mark.at}` : '없음'),
    ),
    h('h2', {}, '① 카카오톡 → 바깥 브라우저'),
    h('p', { class: 'hint' }, '카카오톡 대화방에서 이 페이지를 연 뒤 하나씩 눌러 보세요. 무엇이 열렸는지(크롬, 삼성 인터넷, 아무 일 없음) 알려 주세요.'),
    openExt,
    intent,
    h('h2', {}, '② 저장한 곳 넘기기 · 함께 쓰기'),
    h('p', { class: 'hint' }, '카톡 안에서 장면을 몇 곳 [저장]한 뒤 ①로 넘어가면, 크롬 쪽 "주소로 받은 장면"에 숫자가 보여야 해요. 크롬에서 실험 표시를 남기고, 설치한 앱에서 이 페이지를 열어 표시가 보이는지도 봐 주세요.'),
    merge,
    markBtn,
    h('h2', {}, '③·④ 설치 창'),
    h('p', { class: 'hint' }, '크롬·삼성 인터넷에서 열고 몇 초 기다리면 버튼이 켜져요. 켜지지 않으면 그대로 알려 주세요.'),
    install,
    h('h2', {}, '보내기'),
    copy,
    pre,
    h('ul', { class: 'log' }, ...log.map((l) => h('li', {}, l))),
  );
}

async function checkSw(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    swState = '이 브라우저는 못 씀';
    return paint();
  }
  try {
    if (location.hostname === 'lucubrate1231.github.io') await navigator.serviceWorker.register('../sw.js', { scope: '../' });
    const reg = await navigator.serviceWorker.getRegistration('../');
    swState = !reg ? '없음' : navigator.serviceWorker.controller ? '등록됨 · 이 화면을 맡음' : '등록됨(새로고침하면 맡음)';
  } catch (e) {
    swState = `등록 실패: ${(e as Error).message}`;
  }
  paint();
}

paint();
void checkSw();
win.setTimeout(() => {
  if (!installEvent) note('10초 동안 설치 창 신호 없음');
}, 10000);
