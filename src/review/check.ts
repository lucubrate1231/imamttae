/**
 * 작가 확인용 장면 목록 (_review/check.html)
 * 휴대폰에서 장면을 번호 순서로 훑어보고, 고칠 곳을 번호로 카톡에 알려 주시도록 만든 페이지입니다.
 * 저장 기능은 없습니다. 확인 결과는 '장면 확인표'에 사용자가 옮겨 적습니다.
 */
import './check.css';
import type { ContentFile, StoryScene } from '../../shared/schema/content';
import { sceneTier, visitedMonth, isYearRound } from '../domain/sceneTier';
import { SCENE_TYPES } from '../domain/sceneTypes';

type Scene = StoryScene;
type Filter = 'all' | 'ask' | 'peak' | 'record';
/** 작가님께 여쭐 법규 문장(D20) — content/review/legal.json */
interface LegalPost {
  brunchNo: number;
  title: string;
  url: string;
  status: 'open' | 'fixed';
  scenes: string[];
  items: { why: string; where: string; sentence: string }[];
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: (Node | string | null)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  for (const k of kids) if (k !== null) el.append(k);
  return el;
}
const thumb = (src: string, size = 160) => `https://img1.daumcdn.net/thumb/C${size}x${size}/?fname=${encodeURIComponent(src)}`;
const label = (id: string) => SCENE_TYPES.find((t) => t.id === id)?.label ?? id;
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return d ? `${y}년 ${m}월 ${d}일` : `${y}년 ${m}월`;
};
const draft = (isDraft: boolean) => (isDraft ? h('span', { class: 'draft', text: '초안' }) : null);
const kakaoMapLink = (name: string, lat: number, lng: number) => `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;

const main = h('main', {});
document.getElementById('app')!.append(main);

let scenes: Scene[] = [];
let notes: Record<string, string> = {};
let legal: LegalPost[] = [];
const legalOpen = new Set<string>();
let filter: Filter = 'all';

function item(s: Scene, no: number): HTMLElement {
  const peak = sceneTier(s) === 'peak';
  const ask = notes[s.id];
  const d = h(
    'details',
    { id: s.id },
    h(
      'summary',
      {},
      h('span', { class: 'no', text: String(no) }),
      h('img', { src: thumb(s.photos[0]!.src), alt: '', loading: 'lazy' }),
      h(
        'span',
        { class: 'sum' },
        h('b', { text: s.name }),
        h('span', { text: s.region }),
        h('br', {}),
        h('span', { class: `tag ${peak ? 'peak' : 'rec'}`, text: peak ? '제철' : '작가 부부 방문' }),
        ask ? h('span', { class: 'tag ask', text: '메모' }) : null,
        legalOpen.has(s.id) ? h('span', { class: 'tag ask', text: '문장 확인' }) : null,
      ),
      h('span', { class: 'chev', 'aria-hidden': 'true', text: '›' }),
    ),
  );
  const best = s.best;
  const bestText = best ? `${best.season ? `${best.season} · ` : ''}${best.note}` : '없음';
  const tierText = peak
    ? `제철 — 가장 좋은 때(${best?.season ?? ''})에 다녀오셔서 그 달들에 크게 보여요`
    : best && !isYearRound(best)
      ? `작가 부부 방문 — ${visitedMonth(s.visited)}월에 다녀오셔서 ${visitedMonth(s.visited)}월에만 작게 보여요`
      : `작가 부부 방문 — 일 년 내내 볼 수 있는 곳이라 다녀온 ${visitedMonth(s.visited)}월에만 작게 보여요`;
  const m = peak ? (best!.from as number) : visitedMonth(s.visited);
  const appUrl = `./v2.html?m=${m}#scene=${encodeURIComponent(s.id)}`;
  d.append(
    h(
      'div',
      { class: 'body' },
      h('div', { class: 'photos', tabindex: '0', 'aria-label': `사진 ${s.photos.length}장` }, ...s.photos.map((p, i) => h('img', { src: thumb(p.src, 400), alt: i === 0 ? `${s.name} 대표 사진` : '', loading: 'lazy' }))),
      ask ? h('div', { class: 'ask' }, h('h3', { text: '앱 팀 메모 · 맞는지 봐 주세요' }), h('p', { text: ask })) : null,
      h(
        'dl',
        {},
        h('div', {}, h('dt', { text: '풍경 종류' }), h('dd', {}, s.types.map(label).join(', '), draft(s.review.types === 'draft'))),
        h('div', {}, h('dt', { text: '가장 좋은 때' }), h('dd', {}, bestText, draft(s.review.best === 'draft'), h('small', { text: tierText }))),
        best?.tip ? h('div', {}, h('dt', { text: '이럴 때 더 좋아요' }), h('dd', {}, best.tip, draft(s.review.best === 'draft'))) : null,
        h('div', {}, h('dt', { text: '한 줄 소개' }), h('dd', {}, s.oneLiner, draft(s.review.oneLiner === 'draft'))),
        h('div', {}, h('dt', { text: '가는 곳(길찾기 목적지)' }), h('dd', {}, s.dest.name, draft(s.review.dest === 'draft'))),
        h('div', {}, h('dt', { text: '다녀온 날' }), h('dd', { text: fmtDate(s.visited) })),
      ),
      h('blockquote', { text: s.excerpt }),
      h(
        'div',
        { class: 'links' },
        h('a', { class: 'main', href: appUrl, text: '앱 화면으로 보기' }),
        h('a', { href: kakaoMapLink(s.dest.name, s.dest.lat, s.dest.lng), target: '_blank', rel: 'noopener', text: '가는 곳 지도에서 확인' }),
        h('a', { href: s.brunchUrl, target: '_blank', rel: 'noopener', text: '브런치 글 보기' }),
      ),
    ),
  );
  return d;
}

const list = h('div', {});
const filters = h('nav', { class: 'filters', 'aria-label': '골라 보기' });
const counts = { all: 0, ask: 0, peak: 0, record: 0 };
function renderList(): void {
  const nodes: HTMLElement[] = [];
  let lastTrip = '';
  scenes.forEach((s, i) => {
    const peak = sceneTier(s) === 'peak';
    if (filter === 'ask' && !notes[s.id]) return;
    if (filter === 'peak' && !peak) return;
    if (filter === 'record' && peak) return;
    const trip = s.trip ?? `브런치 ${s.brunchNo}번 글`;
    if (trip !== lastTrip) {
      nodes.push(h('h2', { class: 'trip', text: trip }));
      lastTrip = trip;
    }
    nodes.push(item(s, i + 1));
  });
  list.replaceChildren(...(nodes.length ? nodes : [h('p', { class: 'empty', text: '해당하는 장면이 없어요.' })]));
}

/** 맨 위 '여쭤볼 문장' 상자: 아직 남은 글(open)은 위치와 문장, 고치신 글(fixed)은 한 줄로 */
function legalSection(): HTMLElement | null {
  if (!legal.length) return null;
  const open = legal.filter((p) => p.status === 'open');
  const fixed = legal.filter((p) => p.status === 'fixed');
  const byId = new Map(scenes.map((s, i) => [s.id, i + 1]));
  const sceneRef = (p: LegalPost) =>
    p.scenes
      .filter((id) => byId.has(id))
      .map((id) => `${byId.get(id)}번 ${scenes[byId.get(id)! - 1]!.name}`)
      .join(', ');
  return h(
    'section',
    { class: 'legal', 'aria-labelledby': 'legal-h' },
    h('h2', { id: 'legal-h', text: '글에서 여쭤볼 문장' }),
    h('p', { text: '주차장에서 텐트·차박처럼 규칙에 어긋나 보일 수 있는 문장이에요. 고치실지는 작가님이 정해 주세요. 그대로 두시면 이 글의 장면은 앱에서 잠시 빼 둘게요.' }),
    ...open.map((p) =>
      h(
        'div',
        { class: 'legal-post' },
        h('h3', {}, h('a', { href: p.url, target: '_blank', rel: 'noopener', text: `브런치 #${p.brunchNo}(${p.title})` })),
        sceneRef(p) ? h('p', { class: 'scenes', text: `앱 장면: ${sceneRef(p)}` }) : null,
        ...p.items.map((it) =>
          h('div', { class: 'legal-item' }, h('p', { class: 'where', text: `${it.where} · ${it.why}` }), h('blockquote', { text: it.sentence })),
        ),
      ),
    ),
    fixed.length ? h('p', { class: 'fixed', text: `고쳐 주신 글: ${fixed.map((p) => `브런치 #${p.brunchNo}(${p.title})`).join(', ')} — 확인했어요. 감사합니다.` }) : null,
  );
}

async function start(): Promise<void> {
  try {
    const [a, n, l] = await Promise.all([
      fetch(new URL('../data/scenes.json', location.href)),
      fetch(new URL('./notes.json', location.href)),
      fetch(new URL('./legal.json', location.href)).catch(() => null),
    ]);
    scenes = ((await a.json()) as ContentFile).scenes.filter((s): s is Scene => s.kind === 'story');
    notes = n.ok ? ((await n.json()) as Record<string, string>) : {};
    legal = l?.ok ? ((await l.json()) as { posts: LegalPost[] }).posts : [];
  } catch {
    main.append(h('p', { class: 'empty', text: '장면을 불러오지 못했어요. 잠시 뒤 다시 열어 주세요.' }));
    return;
  }
  for (const p of legal) if (p.status === 'open') for (const id of p.scenes) legalOpen.add(id);
  for (const s of scenes) {
    counts.all++;
    if (notes[s.id]) counts.ask++;
    if (sceneTier(s) === 'peak') counts.peak++;
    else counts.record++;
  }
  main.append(
    h(
      'header',
      { class: 'intro' },
      h('h1', { text: '이맘때 풍경 · 장면 확인' }),
      h('p', { text: `작가님 브런치 글에서 고른 장면 ${counts.all}곳입니다. 앱에 이렇게 들어갑니다.` }),
      h(
        'div',
        { class: 'howto' },
        h('b', { text: '보시는 법' }),
        h(
          'ul',
          {},
          h('li', { text: '번호를 누르면 자세히 열려요.' }),
          h('li', {}, h('span', { class: 'draft', text: '초안' }), ' 표시는 앱 팀이 쓴 글이에요. 맞는지 봐 주세요.'),
          h('li', {}, h('b', { text: '앱 팀 메모' }), '에는 사진 위치·주차장처럼 확인이 필요한 점을 적어 두었어요.'),
          h('li', { text: "고칠 곳은 '12번 주차장이 달라요'처럼 번호로 카톡에 알려 주세요." }),
        ),
      ),
      h(
        'div',
        { class: 'legend' },
        h('p', {}, h('span', { class: 'tag peak', text: '제철' }), '가장 좋은 때에 다녀온 곳. 그 철 내내 크게 보여요.'),
        h('p', {}, h('span', { class: 'tag rec', text: '작가 부부 방문' }), '철이 지났거나 일 년 내내 볼 수 있는 곳. 다녀온 달에만 작게 보여요.'),
      ),
    ),
  );
  const opts: [Filter, string][] = [
    ['all', `전체 ${counts.all}`],
    ['ask', `메모 있는 곳 ${counts.ask}`],
    ['peak', `제철 ${counts.peak}`],
    ['record', `작가 부부 방문 ${counts.record}`],
  ];
  for (const [f, t] of opts) {
    const b = h('button', { type: 'button', 'aria-pressed': String(f === filter), text: t });
    b.addEventListener('click', () => {
      filter = f;
      for (const c of filters.children) c.setAttribute('aria-pressed', String(c === b));
      renderList();
    });
    filters.append(b);
  }
  const legalBox = legalSection();
  if (legalBox) main.append(legalBox);
  main.append(filters, list, h('p', { class: 'foot', text: '가장 좋은 때는 해마다 1~2주씩 달라질 수 있어요. 앱에서는 꽃·단풍·억새·눈 장면에 "올해 소식을 확인하세요" 안내를 붙입니다.' }));
  renderList();
  if (location.hash) document.getElementById(decodeURIComponent(location.hash.slice(1)))?.setAttribute('open', '');
}
void start();
