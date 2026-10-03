/**
 * 카카오 지도 어댑터(확정 시안 v2와 같은 동작)
 * - 작은 지도는 손으로 움직이지 않습니다(페이지 스크롤과 다투지 않게).
 * - 핀은 화면 요소(CustomOverlay)로 그립니다: 제철은 계절 색 점, 다녀온 곳은 작은 회색 점, 준비 중은 점선 점.
 * - 장소를 고르면 우리나라 전체를 잠깐 보여 준 뒤 그 장소로 확대합니다(F1-AC5). '움직임 줄이기'면 바로 확대합니다.
 */
import type { KakaoLatLng, KakaoMapInst, KakaoNS, KakaoOverlay } from './kakaoSdk';
import type { MapAdapter, MapPin, PinKind } from './types';

const KOREA = { center: { lat: 36.4, lng: 127.9 }, sw: { lat: 33.15, lng: 125.6 }, ne: { lat: 38.45, lng: 129.6 } };
const CLOSE = 10; // 장소로 확대했을 때의 지도 단계
const CLASS: Record<PinKind, string> = { peak: 'p', record: 'r', placeholder: 'ph' };
const BASE_Z: Record<PinKind, number> = { peak: 2, record: 1, placeholder: 1 };

export function createKakaoMap(kakao: KakaoNS, opts: { reduceMotion?: boolean } = {}): MapAdapter {
  const reduceMotion = opts.reduceMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const K = kakao.maps;
  let map: KakaoMapInst | null = null;
  let pins: { p: MapPin; o: KakaoOverlay; el: HTMLElement }[] = [];
  let handler: ((id: string) => void) | null = null;
  let selected: string | null = null;
  let national: { level: number; center: KakaoLatLng } | null = null;
  let ready = false; // 첫 지도 조각이 뜬 뒤에만 움직임(뜨기 전에 움직이면 빈 화면이 날아다님)
  let timers: number[] = [];

  const clearTimers = () => {
    timers.forEach((t) => window.clearTimeout(t));
    timers = [];
  };

  function flyTo(p: MapPin): void {
    clearTimers();
    if (!map || !ready || !national) return;
    const spot = new K.LatLng(p.lat, p.lng);
    if (reduceMotion) {
      map.setLevel(CLOSE);
      map.setCenter(spot);
      return;
    }
    const m = map;
    const { level, center } = national;
    if (m.getLevel() !== level) m.setLevel(level, { animate: { duration: 350 } });
    timers.push(
      window.setTimeout(() => m.setCenter(center), 380),
      window.setTimeout(() => m.setLevel(CLOSE, { animate: { duration: 700 }, anchor: spot }), 1600),
      window.setTimeout(() => m.panTo(spot), 2350),
    );
  }

  function paint(): void {
    for (const { p, o, el } of pins) {
      const on = p.id === selected;
      el.classList.toggle('on', on);
      o.setZIndex(on ? 10 : BASE_Z[p.kind]);
    }
    const cur = pins.find((x) => x.p.id === selected);
    if (cur) flyTo(cur.p);
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
      national = { level: m.getLevel(), center: m.getCenter() };
      map = m;
      const go = () => {
        if (ready) return;
        ready = true;
        timers.push(window.setTimeout(paint, 500));
      };
      const onFirst = () => {
        K.event.removeListener(m, 'tilesloaded', onFirst);
        go();
      };
      K.event.addListener(m, 'tilesloaded', onFirst);
      timers.push(window.setTimeout(go, 2500));
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
    onPinClick(cb) {
      handler = cb;
    },
    destroy() {
      clearTimers();
      for (const { o } of pins) o.setMap(null);
      pins = [];
      map = null;
    },
  };
}
