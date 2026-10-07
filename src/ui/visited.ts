/**
 * 장면 상세의 [다녀왔어요](F4-AC4~AC6·AC9) — design-guide 6-2, 글자 10-5
 * - 저장한 장면: 제목 구역 아래 상자 "저장된 곳이에요" + [다녀왔어요]
 * - 다녀온 장면(올해): 작은 도장 + "10월 4일에 다녀왔어요" + [날짜 변경]
 * - [다녀왔어요] → 도장 찍히는 순간(누르는 순간 도장이 남음, [확인]은 닫기)
 * - [날짜 변경] → 아래에서 올라오는 '다녀온 날 변경' 창. 다녀온 장면에서 열 때만 '다녀온 기록 지우기'(한 번 더 물음)
 */
import type { StoryScene } from '../../shared/schema/content';
import type { EventData, EventName } from '../analytics';
import type { SavedStore, Visit } from '../storage/saved';
import { h } from './dom';

export interface VisitDeps {
  win: Window;
  scene: StoryScene;
  store: SavedStore;
  /** 오늘(한국 날짜) 'YYYY-MM-DD' */
  todayDate(): string;
  track(name: EventName, data?: EventData): void;
  /** 카톡으로 알리기: 공유 창(없으면 주소 복사) — 장면 상세의 공유와 같은 동작 */
  share(text: string): void;
  /** 덮개(도장 순간·날짜 창)를 붙일 곳 */
  host: HTMLElement;
  /** 저장 상태가 바뀜(다녀옴·지우기) → [저장] 버튼을 다시 그림 */
  onChange(): void;
}

export interface VisitBox {
  /** 제목 구역 안 자리(비어 있을 수 있음) */
  slot: HTMLElement;
  paint(): void;
  /** 열린 덮개를 모두 닫음(상세를 닫을 때) */
  close(): void;
}

const svg = (body: string, size: number, fill = 'none') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const ICON = {
  mark: svg('<path d="M6 3h12v18l-6-4.5L6 21z"/>', 22, 'currentColor'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16.5 9.5"/>', 20),
  talk: svg('<path d="M12 4C7 4 3 7.1 3 11c0 2.4 1.5 4.5 3.9 5.8L6 20.5l4.2-2.6c.6.1 1.2.1 1.8.1 5 0 9-3.1 9-7s-4-7-9-7z"/>', 22),
  cal: svg('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>', 22),
};
const md = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`;
const ymd = (date: string) => `${Number(date.slice(0, 4))}년 ${md(date)}`;
const yearOf = (date: string) => Number(date.slice(0, 4));

export function createVisitBox(d: VisitDeps): VisitBox {
  const { scene: s, store } = d;
  const doc = d.win.document;
  const slot = h('div', { class: 'vslot' });
  /** 열린 덮개들(위에 있는 것이 뒤) */
  const layers: { el: HTMLElement; close(): void }[] = [];
  const thisYear = () => yearOf(d.todayDate());

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && layers.length) {
      e.preventDefault();
      layers[layers.length - 1]!.close();
    }
  };
  /** 화면을 어둡게 덮고 판을 띄움. 닫으면 덮개를 지우고 초점을 돌려줌 */
  function layer(panel: HTMLElement, kind: 'center' | 'bottom', onClose?: () => void) {
    const back = doc.activeElement as HTMLElement | null;
    const scrim = h('div', { class: `vscrim ${kind}` }, panel);
    scrim.addEventListener('click', (e) => e.target === scrim && item.close());
    const item = {
      el: scrim,
      close() {
        const i = layers.indexOf(item);
        if (i < 0) return;
        layers.splice(i, 1);
        scrim.remove();
        if (!layers.length) doc.removeEventListener('keydown', onKey);
        onClose?.();
        if (back?.isConnected) back.focus();
      },
    };
    if (!layers.length) doc.addEventListener('keydown', onKey);
    layers.push(item);
    d.host.append(scrim);
    return item;
  }

  function paint(): void {
    const v = store.visitOf(s.id, thisYear());
    if (v) {
      const change = h('button', { type: 'button', class: 'vbox-change', text: '날짜 변경' });
      change.addEventListener('click', () => dateSheet(v, { removable: true, onDone: paint }));
      slot.replaceChildren(
        h(
          'div',
          { class: 'vbox done' },
          h('img', { src: `./stamps/${v.type}.webp`, alt: '', class: 'vbox-stamp', width: '60', height: '60' }),
          h('p', { class: 'vbox-msg' }, h('b', { text: md(v.date) }), '에 다녀왔어요'),
          change,
        ),
      );
    } else if (store.isWanted(s.id)) {
      const mark = h('span', { class: 'vbox-icon' });
      mark.innerHTML = ICON.mark;
      const go = h('button', { type: 'button', class: 'vbox-go' });
      go.innerHTML = `${ICON.check}<span>다녀왔어요</span>`;
      go.addEventListener('click', () => {
        const visit = store.markVisited({ id: s.id, name: s.name, types: s.types });
        d.track('visited', { scene: s.id, action: 'mark' });
        paint();
        d.onChange();
        moment(visit);
      });
      slot.replaceChildren(h('div', { class: 'vbox' }, mark, h('p', { class: 'vbox-msg', text: '저장된 곳이에요' }), go));
    } else slot.replaceChildren();
  }

  /** 도장 찍히는 순간(F4-AC5) */
  function moment(first: Visit): void {
    let visit = first;
    const stamp = h('div', { class: 'sm-stamp thud', 'aria-hidden': 'true' }, h('img', { src: `./stamps/${visit.type}-384.webp`, alt: '', width: '148', height: '148' }));
    for (let i = 0; i < 8; i++) stamp.append(h('i', { class: 'sm-line', style: `--a: ${i * 45}deg` }));
    const date = h('p', { class: 'sm-date' });
    const paintDate = () => date.replaceChildren('다녀온 날 ', h('b', { text: md(visit.date) }), visit.date === d.todayDate() ? ' (오늘)' : '');
    paintDate();
    const change = h('button', { type: 'button', class: 'sm-change', text: '날짜 변경' });
    change.addEventListener('click', () =>
      dateSheet(visit, {
        removable: false, // 막 찍은 참이라 지우기는 두지 않음(6-2)
        onDone: (v) => {
          visit = v;
          paintDate();
          paint();
        },
      }),
    );
    const talk = h('button', { type: 'button', class: 'btn line sm-talk' });
    talk.innerHTML = `${ICON.talk}<span>카톡으로 알리기</span>`;
    talk.addEventListener('click', () => d.share(`${s.name}에 다녀왔어요. 이맘때 풍경에서 보고 찾아갔어요.`)); // D58
    const ok = h('button', { type: 'button', class: 'btn fill sm-ok', text: '확인' });
    const card = h(
      'div',
      { class: 'stamp-moment', role: 'dialog', 'aria-modal': 'true', 'aria-label': '도장을 찍었어요' },
      // 도장이 닿는 순간 카드가 3px 눌렸다 돌아옴(디자인 #54) — 카드 안쪽 감싸개에 검
      h(
        'div',
        { class: 'sm-press' },
        stamp,
        h('h2', { class: 'sm-ttl' }, `${s.name}에 `, h('br'), '다녀왔어요'),
        h('div', { class: 'sm-daterow' }, date, change),
        talk,
        ok,
        h('p', { class: 'sm-note', text: "'저장한 곳 › 다녀온 곳'에 모였어요" }),
      ),
    );
    const item = layer(card, 'center');
    ok.addEventListener('click', () => item.close());
    ok.focus();
  }

  /** '다녀온 날 변경' 창(F4-AC6, D10) */
  function dateSheet(v: Visit, o: { removable: boolean; onDone(v: Visit): void }): void {
    const year = yearOf(v.date);
    const sheet = h('div', { class: 'vsheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': '다녀온 날 변경', tabindex: '-1' });
    const item = layer(sheet, 'bottom');

    function dateMode(): void {
      const today = d.todayDate();
      const shown = h('span', { class: 'vs-shown', text: ymd(v.date) });
      const input = h('input', { type: 'date', class: 'vs-input', 'aria-label': '다녀온 날', max: today });
      input.value = v.date;
      // 칸 어디를 눌러도 휴대폰 기본 날짜 고르기가 열리게(안 열리는 브라우저용)
      input.addEventListener('click', () => {
        try {
          input.showPicker?.();
        } catch {
          /* 이미 열림 등 */
        }
      });
      input.addEventListener('change', () => {
        if (input.value) shown.textContent = ymd(input.value);
        err.textContent = '';
      });
      const cal = h('span', { class: 'vs-cal' });
      cal.innerHTML = ICON.cal;
      const err = h('p', { class: 'vs-err', role: 'alert' });
      const save = h('button', { type: 'button', class: 'btn fill', text: '바꾸기' });
      save.addEventListener('click', () => {
        const next = input.value;
        if (!next || next === v.date) return item.close();
        if (next > d.todayDate()) return void (err.textContent = '오늘보다 뒤의 날은 고를 수 없어요.');
        const r = store.changeVisitDate(s.id, year, next);
        if (!r) return void (err.textContent = '그해에는 이미 다녀온 기록이 있어요.');
        d.track('visited', { scene: s.id, action: 'change-date' });
        item.close();
        o.onDone(r);
      });
      const kids: HTMLElement[] = [
        h('span', { class: 'vs-handle', 'aria-hidden': 'true' }),
        h('h2', { class: 'vs-ttl', text: '다녀온 날 변경' }),
        h('p', { class: 'vs-name', text: s.name }),
        h('label', { class: 'vs-field' }, shown, cal, input),
        err,
        save,
      ];
      if (o.removable) {
        const remove = h('button', { type: 'button', class: 'vs-remove', text: '다녀온 기록 지우기' });
        remove.addEventListener('click', confirmMode);
        kids.push(remove);
      }
      sheet.replaceChildren(...kids);
    }

    function confirmMode(): void {
      const keep = h('button', { type: 'button', class: 'btn line', text: '그대로 두기' });
      keep.addEventListener('click', () => item.close());
      const del = h('button', { type: 'button', class: 'btn fill dark', text: '지우기' });
      del.addEventListener('click', () => {
        store.removeVisit(s.id, year);
        d.track('visited', { scene: s.id, action: 'remove' });
        item.close();
        paint();
        d.onChange();
      });
      sheet.replaceChildren(
        h('span', { class: 'vs-handle', 'aria-hidden': 'true' }),
        h('h2', { class: 'vs-ttl', text: '다녀온 기록을 지울까요?' }),
        h('p', { class: 'vs-desc', text: '도장도 함께 지워지고, 가고 싶은 곳으로 돌아가요.' }),
        h('div', { class: 'vs-two' }, keep, del),
      );
      sheet.focus();
    }

    dateMode();
    sheet.focus();
  }

  paint();
  return {
    slot,
    paint,
    close() {
      while (layers.length) layers[layers.length - 1]!.close();
    },
  };
}
