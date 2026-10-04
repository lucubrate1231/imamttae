/**
 * 제철 알림 카드(F4-AC10, D19) — design-guide 9-1, 글자 10-5
 * 저장한 곳 중 오늘이 추천 시기 안인 곳이 있으면 첫 화면(큰 제목 아래·달 띠 위)과 저장한 곳 탭 맨 위에 띄움.
 * 한 곳: 누르면 그 장면 · 여러 곳: 누르면 저장한 곳 탭 · [×]: 그달에는 다시 뜨지 않음(서버·알림 허락 없음)
 */
import type { Scene } from '../../shared/schema/content';
import type { EventData, EventName } from '../analytics';
import { alertScenes } from '../domain/saved';
import type { Month } from '../domain/month';
import type { SavedStore } from '../storage/saved';
import { h, photoImg, thumb } from './dom';

export interface AlertDeps {
  scenes: readonly Scene[];
  store: SavedStore;
  /** 오늘(한국 날짜)의 달과 'YYYY-MM' */
  today: Month;
  monthKey: string;
  where: 'home' | 'saved';
  openScene(id: string): void;
  openSaved(): void;
  /** 닫음 → 다른 자리의 카드도 다시 그림 */
  onClose(): void;
  track(name: EventName, data?: EventData): void;
}

export interface AlertCard {
  /** 카드 자리(카드가 없으면 비어 있고 보이지 않음) */
  el: HTMLElement;
  render(): void;
}

const CLOSE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

export function createAlertCard(d: AlertDeps): AlertCard {
  const el = h('div', { class: 'acslot' });
  let showing = false;

  function render(): void {
    const list = d.store.alertClosed(d.monthKey) ? [] : alertScenes(d.scenes, d.store.wanted(), d.today);
    if (!list.length) {
      el.replaceChildren();
      el.hidden = true;
      showing = false;
      return;
    }
    const count = list.length;
    const first = list[0]!;
    const msg =
      count === 1
        ? h('span', { class: 'ac-msg' }, `저장하신 ${first.name}, `, h('br'), h('b', { text: '지금 가기 좋아요' }))
        : h('span', { class: 'ac-msg' }, `저장하신 ${count}곳이 `, h('br'), h('b', { text: '지금 가기 좋아요' }));
    const photo = first.photos[0];
    const goBtn = h(
      'button',
      { type: 'button', class: 'ac-go' },
      photo ? photoImg(photo, '', { src: thumb(photo.src, 120) }) : h('span', { class: 'ac-ph' }),
      h('span', { class: 'ac-text' }, msg, count > 1 && h('span', { class: 'ac-sub', text: `${first.name} 외 ${count - 1}곳` })),
    );
    goBtn.addEventListener('click', () => {
      d.track('alert-card', { action: 'open', where: d.where, count });
      if (count === 1) d.openScene(first.id);
      else d.openSaved();
    });
    const close = h('button', { type: 'button', class: 'ac-x', 'aria-label': '알림 닫기' });
    close.innerHTML = CLOSE;
    close.addEventListener('click', () => {
      d.store.closeAlert(d.monthKey);
      d.track('alert-card', { action: 'close', where: d.where, count });
      d.onClose();
    });
    el.replaceChildren(h('div', { class: 'acard' }, goBtn, close));
    el.hidden = false;
    if (!showing) d.track('alert-card', { action: 'show', where: d.where, count });
    showing = true;
  }

  el.hidden = true;
  return { el, render };
}
