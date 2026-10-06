import { describe, expect, it } from 'vitest';
import { distanceKm } from '../../src/domain/geo';

const seoul = { lat: 37.5665, lng: 126.978 };
const busan = { lat: 35.1796, lng: 129.0756 };
const jujeongol = { lat: 38.0712, lng: 128.4123 };
const osaekParking = { lat: 38.0601, lng: 128.4398 };

describe('distanceKm: 두 지점 사이 직선거리', () => {
  it('서울–부산 약 325km', () => {
    expect(distanceKm(seoul, busan)).toBeGreaterThan(315);
    expect(distanceKm(seoul, busan)).toBeLessThan(335);
  });
  it('같은 곳은 0', () => expect(distanceKm(seoul, seoul)).toBe(0));
  it('순서를 바꿔도 같다', () => expect(distanceKm(seoul, busan)).toBeCloseTo(distanceKm(busan, seoul), 6));
  it('주전골–오색약수터주차장은 15km 안(가는 곳 규칙)', () => expect(distanceKm(jujeongol, osaekParking)).toBeLessThan(15));
});
