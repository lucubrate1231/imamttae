/**
 * 길찾기 앱 주소 만들기. 이름이 아니라 좌표(주차장·입구)로 넘깁니다.
 * - 카카오맵: 공식 URL https://map.kakao.com/link/to/이름,위도,경도 (앱이 있으면 앱으로 열림)
 * - 네이버지도: nmap://route/car?dlat&dlng&dname&appname (appname 필수)
 * - 티맵: tmap://route?goalname&goalx=경도&goaly=위도 — 요즘 티맵(10/10 안드로이드에서 옛 rGo…만 보내면 목적지가 빈 값). 옛 티맵을 위해 rGoName·rGoX·rGoY도 같이
 */
export type NaviAppId = 'kakao' | 'naver' | 'tmap';

export interface NaviApp {
  id: NaviAppId;
  label: string;
  /** 실제 휴대폰에서 열리는 것을 확인했는가. false면 선택지에 보이지 않음 */
  verified: boolean;
  /** PC 브라우저에서도 열리는가 */
  web: boolean;
}

export const NAVI_APPS: readonly NaviApp[] = [
  { id: 'kakao', label: '카카오맵', verified: true, web: true },
  { id: 'naver', label: '네이버지도', verified: true, web: false },
  { id: 'tmap', label: '티맵', verified: false, web: false },
];

export interface NaviDest {
  name: string;
  lat: number;
  lng: number;
}

/** 대한민국 범위(마라도~백령도·독도) 안의 좌표인가 */
export function isInKorea(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 33.0 && lat <= 38.7 && lng >= 124.5 && lng <= 132.0;
}

export function naviUrl(app: NaviAppId, dest: NaviDest, opts: { appname?: string } = {}): string {
  const { lat, lng } = dest;
  if (!isInKorea(lat, lng)) throw new Error(`좌표가 한국 범위 밖입니다: ${lat}, ${lng}`);
  const name = dest.name.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  switch (app) {
    case 'kakao':
      return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
    case 'naver': {
      if (!opts.appname) throw new Error('네이버지도는 appname이 꼭 필요합니다');
      const q = new URLSearchParams({ dlat: String(lat), dlng: String(lng), dname: name, appname: opts.appname });
      return `nmap://route/car?${q.toString()}`;
    }
    case 'tmap': {
      const q = new URLSearchParams({ goalname: name, goalx: String(lng), goaly: String(lat), rGoName: name, rGoX: String(lng), rGoY: String(lat) });
      return `tmap://route?${q.toString()}`;
    }
  }
}
