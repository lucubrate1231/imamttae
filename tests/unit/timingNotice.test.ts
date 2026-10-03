import { describe, expect, it } from 'vitest';
import { timingNotice, newsSearchUrl } from '../../src/domain/timingNotice';

/**
 * 사용자 요청(10/3): 꽃·단풍처럼 해마다 기온에 따라 달라지는 장면은
 * '가장 좋은 때'를 단정하지 말고, 올해 소식을 확인하라는 안내를 붙인다.
 */
describe('timingNotice: 해마다 달라지는 장면 안내', () => {
  it('꽃 장면 → 개화 소식', () => {
    for (const t of ['maehwa', 'beotkkot', 'jindallae', 'yeoreumkkot', 'kkotmureut'] as const) {
      const n = timingNotice([t])!;
      expect(n.keyword).toBe('개화');
      expect(n.text).toContain('해마다');
    }
  });
  it('단풍 → 단풍 소식, 억새 → 억새 소식', () => {
    expect(timingNotice(['danpung'])!.keyword).toBe('단풍');
    expect(timingNotice(['eoksae'])!.keyword).toBe('억새');
  });
  it('설경 → 눈 소식과 길 상황', () => {
    const n = timingNotice(['seolgyeong', 'ilchul'])!;
    expect(n.keyword).toBe('눈');
    expect(n.text).toContain('길');
  });
  it('철이 해마다 크게 바뀌지 않는 장면(계곡, 바다, 신록, 일출, 운해)은 안내 없음', () => {
    expect(timingNotice(['gyegok'])).toBeNull();
    expect(timingNotice(['bada', 'ilchul'])).toBeNull();
    expect(timingNotice(['sinrok'])).toBeNull();
    expect(timingNotice(['unhae'])).toBeNull();
  });
  it('여러 종류면 앞의 것부터 봄(대표 종류 우선)', () => {
    expect(timingNotice(['sinrok', 'yeoreumkkot'])!.keyword).toBe('개화');
    expect(timingNotice(['jindallae', 'beotkkot'])!.keyword).toBe('개화');
  });
});

describe('timingNotice.short: 카드에 쓰는 짧은 한 줄 (10/3 2차 코멘트: "단풍 시기는 해마다 달라져요")', () => {
  it('종류에 맞는 말', () => {
    expect(timingNotice(['danpung'])!.short).toBe('단풍 시기는 해마다 달라져요');
    expect(timingNotice(['beotkkot'])!.short).toBe('꽃 피는 시기는 해마다 달라져요');
    expect(timingNotice(['eoksae'])!.short).toBe('억새 시기는 해마다 달라져요');
    expect(timingNotice(['seolgyeong'])!.short).toBe('눈이 와야 볼 수 있어요');
  });
  it('짧게(18자 안) — 카드 한 줄에 들어가게', () => {
    for (const t of ['maehwa', 'danpung', 'eoksae', 'seolgyeong'] as const) expect(timingNotice([t])!.short.length).toBeLessThanOrEqual(18);
  });
});

describe('newsSearchUrl: 올해 소식 찾아보기 링크', () => {
  it('장면 이름과 키워드로 검색', () => {
    const u = new URL(newsSearchUrl('내장산 우화정', '단풍'));
    expect(u.origin).toBe('https://search.naver.com');
    expect(u.searchParams.get('query')).toBe('내장산 우화정 단풍');
  });
  it('이름에 키워드가 이미 있으면 겹치지 않게', () => {
    expect(new URL(newsSearchUrl('설악 대승폭포 단풍길', '단풍')).searchParams.get('query')).toBe('설악 대승폭포 단풍길');
  });
});
