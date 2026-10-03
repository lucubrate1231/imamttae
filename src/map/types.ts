/** 지도와 앱 사이의 연결 부품(어댑터). 테스트에서는 가짜 지도를, 실제로는 카카오 지도를 끼웁니다. */
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: 'story' | 'placeholder';
}

export interface MapAdapter {
  readonly kind: 'kakao' | 'list';
  mount(el: HTMLElement): Promise<void>;
  setPins(pins: readonly MapPin[]): void;
  onPinClick(cb: (id: string) => void): void;
  focus(lat: number, lng: number, level?: number): void;
  destroy(): void;
}
