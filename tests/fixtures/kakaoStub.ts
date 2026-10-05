/** 가짜 카카오 SDK: 실제 지도 없이 어댑터가 SDK를 올바르게 부르는지 확인합니다. */
import type { KakaoNS } from '../../src/map/kakaoSdk';

export interface StubLog {
  maps: { center: [number, number]; level: number; opts: Record<string, unknown>; zoomable?: boolean }[];
  overlays: { lat: number; lng: number; el: HTMLElement; onMap: boolean; z: number }[];
  calls: string[];
  /** 지도에 보이는 범위 [남, 서, 북, 동] */
  view: [number, number, number, number];
  /** setBounds 뒤 지도 단계(카카오가 핀에 맞춰 고른 단계) */
  fitLevel: number;
}

export function createKakaoStub(): { kakao: KakaoNS; log: StubLog; fire: (event: string) => void } {
  const log: StubLog = { maps: [], overlays: [], calls: [], view: [34.6, 125.6, 37.9, 130.0], fitLevel: 13 };
  const listeners = new Map<string, (() => void)[]>();
  class LatLng {
    constructor(private lat: number, private lng: number) {}
    getLat() { return this.lat; }
    getLng() { return this.lng; }
  }
  class LatLngBounds { pts: [number, number][] = []; extend(ll: LatLng) { this.pts.push([ll.getLat(), ll.getLng()]); } }
  class KMap {
    rec: StubLog['maps'][number];
    constructor(_el: HTMLElement, o: { center: LatLng; level: number } & Record<string, unknown>) {
      this.rec = { center: [o.center.getLat(), o.center.getLng()], level: o.level, opts: o };
      log.maps.push(this.rec);
    }
    setCenter(ll: LatLng) { this.rec.center = [ll.getLat(), ll.getLng()]; log.calls.push(`center ${ll.getLat()},${ll.getLng()}`); }
    setLevel(l: number) { this.rec.level = l; log.calls.push(`level ${l}`); }
    getLevel() { return this.rec.level; }
    getCenter() { return new LatLng(...this.rec.center); }
    panTo(ll: LatLng) { this.rec.center = [ll.getLat(), ll.getLng()]; log.calls.push(`pan ${ll.getLat()},${ll.getLng()}`); }
    /** 작은 지도에 보이는 범위(가장 넓은 단계에서도 전국이 다 들어가지 않음 — 위아래가 잘림) */
    getBounds() { const [s, w, n, e] = log.view; return { getSouthWest: () => new LatLng(s, w), getNorthEast: () => new LatLng(n, e) }; }
    setBounds(b: LatLngBounds) { this.rec.level = log.fitLevel; log.calls.push(`bounds ${b.pts.length}`); }
    setZoomable(z: boolean) { this.rec.zoomable = z; }
    relayout() {}
  }
  class CustomOverlay {
    rec: StubLog['overlays'][number];
    constructor(o: { position: LatLng; content: HTMLElement; zIndex?: number }) {
      this.rec = { lat: o.position.getLat(), lng: o.position.getLng(), el: o.content, onMap: false, z: o.zIndex ?? 0 };
      log.overlays.push(this.rec);
    }
    setMap(m: unknown) { this.rec.onMap = m !== null; }
    setZIndex(z: number) { this.rec.z = z; }
  }
  const event = {
    addListener: (_t: unknown, name: string, fn: () => void) => listeners.set(name, [...(listeners.get(name) ?? []), fn]),
    removeListener: (_t: unknown, name: string, fn: () => void) => listeners.set(name, (listeners.get(name) ?? []).filter((f) => f !== fn)),
  };
  const kakao = { maps: { load: (cb: () => void) => cb(), LatLng, LatLngBounds, Map: KMap, CustomOverlay, event } } as unknown as KakaoNS;
  return { kakao, log, fire: (name) => [...(listeners.get(name) ?? [])].forEach((f) => f()) };
}
