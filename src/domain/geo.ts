/** 거리 계산과 지도 확대 단계. 길 거리(도로)가 아니라 직선거리입니다. */
export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371; // 지구 반지름(km)
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** 1km 안 / 약 4km / 약 35km / 약 230km — 자릿수가 커질수록 크게 반올림해 읽기 쉽게 */
export function formatDistance(km: number): string {
  if (km < 1) return '1km 안';
  if (km < 10) return `약 ${Math.round(km)}km`;
  if (km < 100) return `약 ${Math.round(km / 5) * 5}km`;
  return `약 ${Math.round(km / 10) * 10}km`;
}

export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

/**
 * 두 지점이 휴대폰 지도(폭 약 360px) 한 화면에 들어오는 카카오 지도 확대 단계.
 * 단계 13 ≈ 가로 500km(전국), 한 단계 내려갈 때마다 절반. 여백을 위해 1.6배로 잡습니다.
 */
export function overviewLevel(km: number): number {
  const need = Math.max(km, 0.001) * 1.6;
  const level = Math.ceil(13 + Math.log2(need / 500));
  return Math.min(13, Math.max(9, level));
}
