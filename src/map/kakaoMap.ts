/** 카카오 지도 어댑터. 핀은 화면 요소(CustomOverlay)로 그려서 디자인을 자유롭게 바꿀 수 있게 합니다. */
import type { KakaoNS, KakaoMapInst, KakaoOverlay } from './kakaoSdk';
import type { MapAdapter, MapPin } from './types';

const KOREA_CENTER = { lat: 36.3, lng: 127.8 };

export function createKakaoMap(kakao: KakaoNS): MapAdapter {
  let map: KakaoMapInst | null = null;
  let overlays: KakaoOverlay[] = [];
  let handler: ((id: string) => void) | null = null;

  return {
    kind: 'kakao',
    async mount(el) {
      map = new kakao.maps.Map(el, { center: new kakao.maps.LatLng(KOREA_CENTER.lat, KOREA_CENTER.lng), level: 13 });
    },
    setPins(pins: readonly MapPin[]) {
      for (const o of overlays) o.setMap(null);
      overlays = [];
      if (!map) return;
      for (const p of pins) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `mappin mappin--${p.kind}`;
        b.dataset.pinId = p.id;
        b.textContent = p.label;
        b.addEventListener('click', () => handler?.(p.id));
        const o = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(p.lat, p.lng), content: b, yAnchor: 1, clickable: true });
        o.setMap(map);
        overlays.push(o);
      }
    },
    onPinClick(cb) {
      handler = cb;
    },
    focus(lat, lng, level) {
      if (!map) return;
      map.setCenter(new kakao.maps.LatLng(lat, lng));
      if (level) map.setLevel(level);
    },
    destroy() {
      for (const o of overlays) o.setMap(null);
      overlays = [];
      map = null;
    },
  };
}
