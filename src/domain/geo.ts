/** 두 지점 사이 직선거리(km). 장면과 '가는 곳(주차장)'이 15km 안인지 검사할 때 씁니다. */
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
