/** 카카오 지도 SDK 불러오기. 실패하거나 너무 오래 걸리면 거절(reject)해서 앱이 '지도를 불러오지 못했어요'로 넘어가게 합니다. */
declare global {
  interface Window {
    kakao?: KakaoNS;
  }
}

// 이 앱이 쓰는 SDK 기능만 적은 최소 타입
export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}
export interface KakaoMapInst {
  setCenter(ll: KakaoLatLng): void;
  setLevel(level: number, opts?: { animate?: { duration: number }; anchor?: KakaoLatLng }): void;
  getLevel(): number;
  getCenter(): KakaoLatLng;
  panTo(ll: KakaoLatLng): void;
  setBounds(b: unknown, top?: number, right?: number, bottom?: number, left?: number): void;
  setZoomable(z: boolean): void;
  relayout(): void;
}
export interface KakaoOverlay {
  setMap(m: KakaoMapInst | null): void;
  setZIndex(z: number): void;
}
export interface KakaoNS {
  maps: {
    load(cb: () => void): void;
    LatLng: new (lat: number, lng: number) => KakaoLatLng;
    LatLngBounds: new (sw?: KakaoLatLng, ne?: KakaoLatLng) => { extend(ll: KakaoLatLng): void; isEmpty?(): boolean };
    Map: new (
      el: HTMLElement,
      opts: { center: KakaoLatLng; level: number; draggable?: boolean; scrollwheel?: boolean; disableDoubleClickZoom?: boolean; keyboardShortcuts?: boolean },
    ) => KakaoMapInst;
    CustomOverlay: new (opts: { position: KakaoLatLng; content: HTMLElement; yAnchor?: number; xAnchor?: number; clickable?: boolean; zIndex?: number }) => KakaoOverlay;
    event: {
      addListener(target: unknown, type: string, fn: () => void): void;
      removeListener(target: unknown, type: string, fn: () => void): void;
    };
  };
}

let pending: Promise<KakaoNS> | null = null;

export function loadKakaoSdk(appkey: string, timeoutMs = 8000, doc: Document = document): Promise<KakaoNS> {
  if (!appkey) return Promise.reject(new Error('카카오 JavaScript 키가 없습니다'));
  if (pending) return pending;
  pending = new Promise<KakaoNS>((resolve, reject) => {
    const done = () => {
      const k = window.kakao;
      if (!k?.maps?.load) return reject(new Error('카카오 SDK가 비어 있습니다(도메인 미등록일 수 있음)'));
      k.maps.load(() => resolve(k));
    };
    if (window.kakao?.maps?.load) return done();
    const s = doc.createElement('script');
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appkey)}&autoload=false`;
    s.async = true;
    const timer = setTimeout(() => reject(new Error('카카오 지도 응답이 늦습니다')), timeoutMs);
    s.onload = () => {
      clearTimeout(timer);
      done();
    };
    s.onerror = () => {
      clearTimeout(timer);
      reject(new Error('카카오 지도 SDK를 불러오지 못했습니다'));
    };
    doc.head.append(s);
  }).catch((e: unknown) => {
    pending = null;
    throw e;
  });
  return pending;
}

/** 테스트용: 불러오기 상태 초기화 */
export function resetKakaoSdkForTest(): void {
  pending = null;
}
