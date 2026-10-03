/** 지도와 앱 사이의 연결 부품(어댑터). 테스트에서는 가짜 지도를, 실제로는 카카오 지도를 끼웁니다. */
/** 핀 종류: 제철 풍경 · 작가 부부가 다녀온 곳 · 준비 중 */
export type PinKind = 'peak' | 'record' | 'placeholder';

export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: PinKind;
}

export interface MapAdapter {
  /** kakao: 실제 지도 · list: 가짜 지도(테스트용 목록) · failed: 지도를 못 불러옴(안내만) */
  readonly kind: 'kakao' | 'list' | 'failed';
  mount(el: HTMLElement): Promise<void>;
  setPins(pins: readonly MapPin[]): void;
  /** 장소 고르기: 그 핀만 이름표를 보이고, 지도는 우리나라 전체 → 그 장소로 확대(F1-AC5·AC6) */
  select(id: string | null): void;
  /** 풍경 찾기: 올린 핀이 모두 보이게 지도를 맞춤(F3-AC2·AC7) */
  fit(): void;
  onPinClick(cb: (id: string) => void): void;
  destroy(): void;
}
