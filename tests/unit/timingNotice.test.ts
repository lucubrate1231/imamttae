import { describe, expect, it } from 'vitest';
import { timingNotice, newsLink } from '../../src/domain/timingNotice';

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

describe("timingNotice.line · newsLink.go: '떠나기 전에 확인하세요' 카드의 시기 줄(디자인 #61)", () => {
  it('안내는 뒤 문장 없이 한 문장', () => {
    expect(timingNotice(['beotkkot'])!.line).toBe('꽃 피는 때는 해마다 1~2주씩 달라져요');
    expect(timingNotice(['danpung'])!.line).toBe('단풍 드는 때는 해마다 1~2주씩 달라져요');
    expect(timingNotice(['eoksae'])!.line).toBe('억새가 가장 좋은 때는 해마다 조금씩 달라져요');
    expect(timingNotice(['seolgyeong'])!.line).toBe('눈이 와야 볼 수 있고, 길이 얼거나 막힐 수 있어요');
  });
  it("찾아보기 글자는 '›' 없이(줄 오른쪽 화살표가 대신)", () => {
    const d = new Date(2026, 9, 4);
    expect(newsLink('x', timingNotice(['danpung'])!, d).go).toBe('올해 단풍지도 찾아보기');
    expect(newsLink('발왕산 상고대', timingNotice(['seolgyeong'])!, d).go).toBe('올해 눈 소식 찾아보기');
  });
});

describe('newsLink: 올해 소식 찾아보기 링크 (10/3 6차 코멘트)', () => {
  const q = (u: string) => new URL(u).searchParams.get('query');
  const oct2026 = new Date(2026, 9, 3);

  it('단풍은 장소가 아니라 "누른 해 + 단풍지도"로 검색', () => {
    const l = newsLink('내장산 우화정', timingNotice(['danpung'])!, oct2026);
    expect(new URL(l.url).origin).toBe('https://search.naver.com');
    expect(q(l.url)).toBe('2026 단풍지도');
    expect(l.label).toBe('올해 단풍지도 찾아보기 ›');
  });
  it('벚꽃은 "누른 해 + 벚꽃지도", 그 밖의 꽃은 "누른 해 + 꽃지도"', () => {
    expect(q(newsLink('경주 대릉원', timingNotice(['beotkkot'])!, oct2026).url)).toBe('2026 벚꽃지도');
    for (const t of ['maehwa', 'jindallae', 'yeoreumkkot', 'kkotmureut'] as const) {
      const l = newsLink('비슬산 참꽃 군락지', timingNotice([t])!, oct2026);
      expect(q(l.url)).toBe('2026 꽃지도');
      expect(l.label).toBe('올해 꽃지도 찾아보기 ›');
    }
  });
  it('해는 누른 때를 따름(해가 바뀌면 그해로)', () => {
    expect(q(newsLink('x', timingNotice(['danpung'])!, new Date(2027, 0, 5)).url)).toBe('2027 단풍지도');
  });
  it('눈은 지금처럼 장소 + 눈으로 검색(그곳 CCTV·눈 소식이 나옴)', () => {
    const l = newsLink('발왕산 상고대', timingNotice(['seolgyeong'])!, oct2026);
    expect(q(l.url)).toBe('발왕산 상고대 눈');
    expect(l.label).toBe('올해 눈 소식 찾아보기 ›');
  });
  it('억새도 장소로 검색(억새 지도는 흔하지 않음), 이름에 키워드가 있으면 겹치지 않게', () => {
    expect(q(newsLink('간월재', timingNotice(['eoksae'])!, oct2026).url)).toBe('간월재 억새');
    expect(q(newsLink('신불산 억새평원', timingNotice(['eoksae'])!, oct2026).url)).toBe('신불산 억새평원');
  });
});
