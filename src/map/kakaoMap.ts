/**
 * 카카오 지도 어댑터(확정 시안 v2와 같은 동작)
 * - 작은 지도는 손으로 움직이지 않습니다(페이지 스크롤과 다투지 않게).
 * - 핀은 화면 요소(CustomOverlay)로 그립니다: 제철은 계절 색 점, 다녀온 곳은 작은 회색 점, 준비 중은 점선 점.
 * - 장소를 고르면 그 핀만 이름표를 보이고 맨 앞으로 올립니다. 확대는 하지 않습니다(F1-AC5, D39 —
 *   확대하면 지도 그림을 다시 받느라 늦게 떠서 뺌, #77). 고른 곳이 칸 밖이면 확대 없이 옮기기만 합니다.
 */
import type { KakaoMapInst, KakaoNS, KakaoOverlay } from './kakaoSdk';
import type { MapAdapter, MapPin, PinKind } from './types';

const KOREA = { center: { lat: 36.4, lng: 127.9 }, sw: { lat: 33.15, lng: 125.6 }, ne: { lat: 38.45, lng: 129.6 } };
const CLASS: Record<PinKind, string> = { peak: 'p', record: 'r', placeholder: 'ph' };
const BASE_Z: Record<PinKind, number> = { peak: 2, record: 1, placeholder: 1 };

export function createKakaoMap(kakao: KakaoNS): MapAdapter {
  const K = kakao.maps;
  let map: KakaoMapInst | null = null;
  let pins: { p: MapPin; o: KakaoOverlay; el: HTMLElement }[] = [];
  let handler: ((id: string) => void) | null = null;
  let selected: string | null = null;

  function paint(): void {
    for (const { p, o, el } of pins) {
      const on = p.id === selected;
      el.classList.toggle('on', on);
      o.setZIndex(on ? 10 : BASE_Z[p.kind]);
    }
    const cur = pins.find((x) => x.p.id === selected);
    if (cur) reveal(cur.p);
  }

  /**
   * 작은 지도 칸(높이 210)은 카카오 지도의 가장 넓은 단계에서도 전국이 다 들어가지 않습니다(위아래가 잘림).
   * 고른 곳이 칸 밖(또는 이름표가 잘리는 가장자리)이면 확대 없이 그곳이 보이게 옮깁니다(D39 — 확대는 하지 않음).
   */
  function reveal(p: MapPin): void {
    if (!map) return;
    const b = map.getBounds?.();
    if (!b) return; // 지도가 아직 크기를 모름
    const s = b.getSouthWest().getLat();
    const w = b.getSouthWest().getLng();
    const n = b.getNorthEast().getLat();
    const e = b.getNorthEast().getLng();
    const dy = n - s;
    const dx = e - w;
    const inside = p.lat > s + dy * 0.05 && p.lat < n - dy * 0.12 && p.lng > w + dx * 0.15 && p.lng < e - dx * 0.15; // 위쪽은 이름표 자리, 옆은 이름 길이만큼 띄움
    if (!inside) map.panTo(new K.LatLng(p.lat, p.lng));
  }

  return {
    kind: 'kakao',
    async mount(el) {
      const m = new K.Map(el, {
        center: new K.LatLng(KOREA.center.lat, KOREA.center.lng),
        level: 13,
        draggable: false,
        scrollwheel: false,
        disableDoubleClickZoom: true,
        keyboardShortcuts: false,
      });
      m.setZoomable(false);
      m.setBounds(new K.LatLngBounds(new K.LatLng(KOREA.sw.lat, KOREA.sw.lng), new K.LatLng(KOREA.ne.lat, KOREA.ne.lng)), 4, 4, 4, 4);
      map = m;
    },
    setPins(list: readonly MapPin[]) {
      for (const { o } of pins) o.setMap(null);
      pins = [];
      if (!map) return;
      for (const p of list) {
        const el = document.createElement('div');
        el.className = `pin ${CLASS[p.kind]}`;
        el.dataset.pinId = p.id;
        const nm = document.createElement('div');
        nm.className = 'nm';
        nm.textContent = p.label;
        const dot = document.createElement('div');
        dot.className = 'dot';
        el.append(nm, dot);
        el.addEventListener('click', () => handler?.(p.id));
        const o = new K.CustomOverlay({ position: new K.LatLng(p.lat, p.lng), content: el, yAnchor: 1, clickable: true, zIndex: BASE_Z[p.kind] });
        o.setMap(map);
        pins.push({ p, o, el });
      }
      paint();
    },
    select(id) {
      selected = id;
      paint();
    },
    fit() {
      if (!map || pins.length === 0) return;
      map.relayout(); // 숨어 있던 칸에서 처음 보일 때 크기를 다시 잼
      const b = new K.LatLngBounds();
      for (const { p } of pins) b.extend(new K.LatLng(p.lat, p.lng));
      map.setBounds(b, 24, 24, 24, 24);
    },
    onPinClick(cb) {
      handler = cb;
    },
    destroy() {
      for (const { o } of pins) o.setMap(null);
      pins = [];
      map = null;
    },
  };
}
