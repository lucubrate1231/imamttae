/**
 * 카카오 지도 어댑터(확정 시안 v2와 같은 동작)
 * - 작은 지도는 손으로 움직이지 않습니다(페이지 스크롤과 다투지 않게).
 * - 핀은 화면 요소(CustomOverlay)로 그립니다: 제철은 계절 색 점, 다녀온 곳은 작은 회색 점, 준비 중은 점선 점.
 * - 장소를 고르면 그 핀만 이름표를 보이고 맨 앞으로 올립니다(F1-AC5).
 * - 첫 화면 지도(focusLevel)는 9단계로 시작하고, 고른 곳을 움직임 없이 가운데로 둡니다(10/5 사용자).
 *   단계는 바꾸지 않습니다 — 전국 → 확대 움직임은 지도 그림을 두 번 받아 늦게 떠서 뺐습니다(D39, #77).
 * - 풍경 찾기 지도는 우리나라 전체로 시작해 fit()으로 맞추고, 고른 곳이 칸 밖이면 옮기기만 합니다.
 * - 어느 화면도 9단계(CLOSEST_LEVEL)보다 가까이 가지 않습니다.
 */
import type { KakaoMapInst, KakaoNS, KakaoOverlay } from './kakaoSdk';
import type { MapAdapter, MapPin, PinKind } from './types';

const KOREA = { center: { lat: 36.4, lng: 127.9 }, sw: { lat: 33.15, lng: 125.6 }, ne: { lat: 38.45, lng: 129.6 } };
/** 어느 화면도 이보다 가까이 가지 않음(카카오 단계는 작을수록 가까이. 7·8단계는 등고선이 빽빽함 — 메시지 V, 10/5) */
export const CLOSEST_LEVEL = 9;
const CLASS: Record<PinKind, string> = { peak: 'p', record: 'r', placeholder: 'ph' };
const BASE_Z: Record<PinKind, number> = { peak: 2, record: 1, placeholder: 1 };

/**
 * focusLevel: 첫 화면 지도. 이 단계로 시작하고, 고른 곳을 움직임 없이 가운데로 둡니다(10/5 사용자 — 9단계).
 *   없으면(풍경 찾기) 우리나라 전체로 시작하고 fit()으로 맞춥니다.
 */
export function createKakaoMap(kakao: KakaoNS, opts: { focusLevel?: number } = {}): MapAdapter {
  const { focusLevel } = opts;
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
    if (!cur || !map) return;
    if (focusLevel) map.setCenter(new K.LatLng(cur.p.lat, cur.p.lng)); // 움직임 없이 — 그 단계의 지도 그림만 받음
    else reveal(cur.p);
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

  let host: HTMLElement | null = null;
  let watcher: ResizeObserver | null = null;
  let lastSize = '';
  /**
   * 칸이 보이거나 크기가 바뀌면 지도를 다시 맞춤. 숨은 칸(0×0 — 다른 탭에 있을 때)에서 만들거나 옮긴 지도는
   * 카카오가 크기를 0으로 기억해 지도 그림이 안 뜸(10/5 — 저장한 곳에서 열고 첫 화면으로 가면 깨짐)
   */
  function onResize(): void {
    if (!host || !map) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    const size = `${w}x${h}`;
    if (!w || !h || size === lastSize) return;
    lastSize = size;
    map.relayout();
    const cur = focusLevel ? pins.find((x) => x.p.id === selected) : undefined;
    if (cur) map.setCenter(new K.LatLng(cur.p.lat, cur.p.lng));
  }
  let waiting: readonly MapPin[] | null = null; // 첫 화면 지도: 처음 고를 때까지 기다리는 핀

  /** 지도 만들기. 첫 화면 지도는 처음 고른 곳에서 바로 시작(다른 곳 지도 그림을 먼저 받지 않게 — 메시지 V 2) */
  function create(center: { lat: number; lng: number }): void {
    if (!host) return;
    const m = new K.Map(host, {
      center: new K.LatLng(center.lat, center.lng),
        level: focusLevel ?? 13,
        draggable: false,
        scrollwheel: false,
        disableDoubleClickZoom: true,
      keyboardShortcuts: false,
    });
    m.setZoomable(false);
    if (!focusLevel) m.setBounds(new K.LatLngBounds(new K.LatLng(KOREA.sw.lat, KOREA.sw.lng), new K.LatLng(KOREA.ne.lat, KOREA.ne.lng)), 4, 4, 4, 4);
    map = m;
  }

  function addPins(list: readonly MapPin[]): void {
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
  }

  return {
    kind: 'kakao',
    async mount(el) {
      host = el;
      if (typeof ResizeObserver === 'function') {
        watcher = new ResizeObserver(onResize);
        watcher.observe(el);
      }
      if (!focusLevel) create(KOREA.center);
    },
    setPins(list: readonly MapPin[]) {
      for (const { o } of pins) o.setMap(null);
      pins = [];
      if (!map) {
        if (focusLevel && host) waiting = list; // 처음 고를 때 그곳에서 지도를 만들고 올림
        return;
      }
      addPins(list);
      paint();
    },
    select(id) {
      selected = id;
      if (!map && focusLevel && host) {
        create(waiting?.find((p) => p.id === id) ?? KOREA.center);
        if (waiting) addPins(waiting);
        waiting = null;
      }
      paint();
    },
    fit() {
      if (!map || pins.length === 0) return;
      map.relayout(); // 숨어 있던 칸에서 처음 보일 때 크기를 다시 잼
      const b = new K.LatLngBounds();
      for (const { p } of pins) b.extend(new K.LatLng(p.lat, p.lng));
      map.setBounds(b, 24, 24, 24, 24);
      if (map.getLevel() < CLOSEST_LEVEL) map.setLevel(CLOSEST_LEVEL); // 핀이 하나뿐이거나 모여 있을 때
    },
    onPinClick(cb) {
      handler = cb;
    },
    destroy() {
      watcher?.disconnect();
      watcher = null;
      for (const { o } of pins) o.setMap(null);
      pins = [];
      map = null;
    },
  };
}
