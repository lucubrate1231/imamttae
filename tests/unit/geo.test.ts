import { describe, expect, it } from 'vitest';
import { distanceKm, formatDistance, midpoint, overviewLevel } from '../../src/domain/geo';

const seoul = { lat: 37.5665, lng: 126.978 };
const busan = { lat: 35.1796, lng: 129.0756 };
const naejang = { lat: 35.4864, lng: 126.9103 };

describe('distanceKm: 두 지점 사이 직선거리', () => {
  it('서울–부산 약 325km', () => {
    expect(distanceKm(seoul, busan)).toBeGreaterThan(315);
    expect(distanceKm(seoul, busan)).toBeLessThan(335);
  });
  it('같은 곳은 0', () => expect(distanceKm(seoul, seoul)).toBe(0));
  it('순서를 바꿔도 같다', () => expect(distanceKm(seoul, naejang)).toBeCloseTo(distanceKm(naejang, seoul), 6));
});

describe('formatDistance: 어르신이 읽기 쉬운 거리 표시', () => {
  it.each([
    [0.4, '1km 안'],
    [3.6, '약 4km'],
    [37, '약 35km'],
    [42.6, '약 45km'],
    [231, '약 230km'],
    [326, '약 330km'],
  ])('%s km → %s', (km, want) => expect(formatDistance(km)).toBe(want));
});

describe('overviewLevel: 내 위치와 장면이 한 화면에 들어오는 지도 확대 단계', () => {
  it('멀수록 더 넓게 본다(단계 숫자가 커짐)', () => {
    expect(overviewLevel(20)).toBeLessThan(overviewLevel(80));
    expect(overviewLevel(80)).toBeLessThanOrEqual(overviewLevel(300));
  });
  it('가까워도 너무 확대하지 않고(9 이상), 멀어도 전국 보기(13)를 넘지 않는다', () => {
    expect(overviewLevel(0.2)).toBe(9);
    expect(overviewLevel(2000)).toBe(13);
  });
});

describe('midpoint', () => {
  it('두 지점의 가운데', () => {
    expect(midpoint(seoul, busan)).toEqual({ lat: (37.5665 + 35.1796) / 2, lng: (126.978 + 129.0756) / 2 });
  });
});
