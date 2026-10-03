import { describe, expect, it } from 'vitest';
import { parseVisitDate, findDateLine } from '../../src/domain/dateLine';

// 실제 브런치 발행본의 날짜 줄 표본 (2026-10-03 기준 1~26번 글)
describe('parseVisitDate: 작가가 글 맨 위에 쓰는 날짜 줄을 읽는다', () => {
  it.each([
    ['2019년 7월 29일 - 구름 약간', { year: 2019, month: 7, day: 29 }],
    ['2019. 10. 12', { year: 2019, month: 10, day: 12 }],
    ['20년 1월 31일', { year: 2020, month: 1, day: 31 }],
    ['22년 10월 23일', { year: 2022, month: 10, day: 23 }],
  ])('%s', (line, want) => {
    expect(parseVisitDate(line)).toEqual(want);
  });

  it.each([
    ['2019년 12월 5일 - 12월 6일', { year: 2019, month: 12, day: 5, endMonth: 12, endDay: 6 }],
    ['20년 6월 4일~5일(1박2일)', { year: 2020, month: 6, day: 4, endDay: 5 }],
    ['20년 8월 25~26일', { year: 2020, month: 8, day: 25, endDay: 26 }],
    ['22년 1월 19~20일(1박 2일)', { year: 2022, month: 1, day: 19, endDay: 20 }],
    ['22년 8월 2.3.4일(2박3일)', { year: 2022, month: 8, day: 2, endDay: 4 }],
  ])('여러 날 여행: %s', (line, want) => {
    expect(parseVisitDate(line)).toEqual(want);
  });

  it.each([
    ['20넌 11월 3일', { year: 2020, month: 11, day: 3 }],
    ['24녈 10월 5일', { year: 2024, month: 10, day: 5 }],
    ['21널 12월 1일', { year: 2021, month: 12, day: 1 }],
  ])('원문 오타도 읽는다: %s', (line, want) => {
    expect(parseVisitDate(line)).toEqual(want);
  });

  it('달만 있고 날이 없으면 달까지만', () => {
    expect(parseVisitDate('23년 11월')).toEqual({ year: 2023, month: 11 });
  });

  it.each([
    '살아서 가볼 100곳',
    '12월 5일',
    '아내와 함께한 2019년의 기억',
    '2019년 13월 2일',
    '19년 0월 2일',
    '',
  ])('날짜 줄이 아니면 null: %j', (line) => {
    expect(parseVisitDate(line)).toBeNull();
  });
});

describe('findDateLine: 첫 소제목 전 문단에서 찾고, 없으면 앞쪽 문단 6개에서 한 번 더 찾는다', () => {
  it('첫 소제목 전', () => {
    const items = [
      { t: 'p', text: '도입 문장' },
      { t: 'p', text: '21년 10월 4일~5일' },
      { t: 'h2', text: '부석사' },
    ] as const;
    expect(findDateLine(items)).toBe('21년 10월 4일~5일');
  });
  it('구분선·소제목 뒤에 있는 경우', () => {
    const items = [
      { t: 'p', text: '도입' },
      { t: 'hr' },
      { t: 'h2', text: '설악산' },
      { t: 'p', text: '2019. 10. 12' },
    ] as const;
    expect(findDateLine(items)).toBe('2019. 10. 12');
  });
  it('없으면 null', () => {
    expect(findDateLine([{ t: 'p', text: '60대 부부의 약속' }])).toBeNull();
  });
});
