/** 가짜 카카오 SDK: 실제 지도 없이 어댑터가 SDK를 올바르게 부르는지 확인합니다. */
import type { KakaoNS } from '../../src/map/kakaoSdk';

export interface StubLog {
  maps: { center: [number, number]; level: number }[];
  overlays: { lat: number; lng: number; el: HTMLElement; onMap: boolean }[];
}

export function createKakaoStub(): { kakao: KakaoNS; log: StubLog } {
  const log: StubLog = { maps: [], overlays: [] };
  class LatLng {
    constructor(private lat: number, private lng: number) {}
    getLat() { return this.lat; }
    getLng() { return this.lng; }
  }
  class LatLngBounds { extend() {} }
  class KMap {
    rec: { center: [number, number]; level: number };
    constructor(_el: HTMLElement, o: { center: LatLng; level: number }) {
      this.rec = { center: [o.center.getLat(), o.center.getLng()], level: o.level };
      log.maps.push(this.rec);
    }
    setCenter(ll: LatLng) { this.rec.center = [ll.getLat(), ll.getLng()]; }
    setLevel(l: number) { this.rec.level = l; }
    setBounds() {}
    relayout() {}
  }
  class CustomOverlay {
    rec: StubLog['overlays'][number];
    constructor(o: { position: LatLng; content: HTMLElement }) {
      this.rec = { lat: o.position.getLat(), lng: o.position.getLng(), el: o.content, onMap: false };
      log.overlays.push(this.rec);
    }
    setMap(m: unknown) { this.rec.onMap = m !== null; }
  }
  const kakao = { maps: { load: (cb: () => void) => cb(), LatLng, LatLngBounds, Map: KMap, CustomOverlay } } as unknown as KakaoNS;
  return { kakao, log };
}
