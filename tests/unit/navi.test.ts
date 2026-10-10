import { describe, expect, it } from 'vitest';
import { naviUrl, NAVI_APPS, isInKorea } from '../../src/domain/navi';

const dest = { name: '오색약수터주차장', lat: 38.0601, lng: 128.4398 };

describe('naviUrl: 이름이 아니라 좌표로 길찾기 앱을 연다', () => {
  it('카카오맵: 공식 link/to 주소, 이름·위도·경도 순서', () => {
    expect(naviUrl('kakao', dest)).toBe(
      'https://map.kakao.com/link/to/' + encodeURIComponent('오색약수터주차장') + ',38.0601,128.4398',
    );
  });

  it('카카오맵: 이름에 쉼표가 있으면 주소가 깨지지 않게 뺀다', () => {
    const url = naviUrl('kakao', { ...dest, name: '주전골, 오색' });
    expect(url).toContain(encodeURIComponent('주전골 오색') + ',38.0601,128.4398');
  });

  it('네이버지도: nmap 스킴, 도착 위도·경도, appname 필수', () => {
    const url = new URL(naviUrl('naver', dest, { appname: 'imamttae.github.io' }));
    expect(url.protocol).toBe('nmap:');
    expect(url.searchParams.get('dlat')).toBe('38.0601');
    expect(url.searchParams.get('dlng')).toBe('128.4398');
    expect(url.searchParams.get('dname')).toBe('오색약수터주차장');
    expect(url.searchParams.get('appname')).toBe('imamttae.github.io');
  });

  it('네이버지도: appname 없으면 오류(빠뜨리면 앱이 안 열림)', () => {
    expect(() => naviUrl('naver', dest)).toThrow(/appname/);
  });

  it('티맵: X가 경도, Y가 위도 (순서 바뀌면 바다로 안내됨)', () => {
    const url = new URL(naviUrl('tmap', dest));
    expect(url.protocol).toBe('tmap:');
    expect(url.searchParams.get('rGoX')).toBe('128.4398');
    expect(url.searchParams.get('rGoY')).toBe('38.0601');
    expect(url.searchParams.get('rGoName')).toBe('오색약수터주차장');
  });

  it('10/10 버그: 요즘 티맵은 목적지를 goalname·goalx·goaly로 읽음(옛 rGo… 만 보내면 안드로이드 티맵 목적지가 빈 값) — 둘 다 보냄', () => {
    const url = new URL(naviUrl('tmap', dest));
    expect(url.searchParams.get('goalx')).toBe('128.4398');
    expect(url.searchParams.get('goaly')).toBe('38.0601');
    expect(url.searchParams.get('goalname')).toBe('오색약수터주차장');
  });

  it('한국 밖 좌표(위도·경도 뒤바뀜 포함)는 거부한다', () => {
    expect(() => naviUrl('kakao', { name: 'x', lat: 128.4398, lng: 38.0601 })).toThrow(/좌표/);
    expect(() => naviUrl('kakao', { name: 'x', lat: Number.NaN, lng: 128 })).toThrow(/좌표/);
  });

  it('티맵은 실기기 확인 전까지 선택지에서 숨긴다', () => {
    expect(NAVI_APPS.map((a) => a.id)).toEqual(['kakao', 'naver', 'tmap']);
    expect(NAVI_APPS.find((a) => a.id === 'tmap')?.verified).toBe(false);
  });

  it('isInKorea: 독도·마라도까지 포함', () => {
    expect(isInKorea(37.2417, 131.8647)).toBe(true); // 독도
    expect(isInKorea(33.1131, 126.2669)).toBe(true); // 마라도
    expect(isInKorea(35.68, 139.76)).toBe(false); // 도쿄
  });
});
