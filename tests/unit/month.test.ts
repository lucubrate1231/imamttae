import { describe, expect, it } from 'vitest';
import { monthInSeoul, inWindow, monthLabel } from '../../src/domain/month';

describe('monthInSeoul: 휴대폰 시간대와 상관없이 한국 날짜로 이번 달을 정한다', () => {
  it('UTC 9월 30일 16시 = 한국 10월 1일 1시', () => {
    expect(monthInSeoul(new Date('2026-09-30T16:00:00Z'))).toBe(10);
  });
  it('UTC 10월 31일 14시 = 한국 10월 31일 23시', () => {
    expect(monthInSeoul(new Date('2026-10-31T14:00:00Z'))).toBe(10);
  });
});

describe('inWindow: 가장 좋은 때 기간 안에 그 달이 들어가는가', () => {
  it('보통 기간', () => {
    expect(inWindow(10, { from: 10, to: 11 })).toBe(true);
    expect(inWindow(11, { from: 10, to: 11 })).toBe(true);
    expect(inWindow(12, { from: 10, to: 11 })).toBe(false);
  });
  it('해를 넘는 기간(12월~2월 상고대)', () => {
    expect(inWindow(12, { from: 12, to: 2 })).toBe(true);
    expect(inWindow(1, { from: 12, to: 2 })).toBe(true);
    expect(inWindow(2, { from: 12, to: 2 })).toBe(true);
    expect(inWindow(3, { from: 12, to: 2 })).toBe(false);
    expect(inWindow(11, { from: 12, to: 2 })).toBe(false);
  });
  it('일 년 내내(일출·낙조처럼 철이 없는 장면)', () => {
    for (let m = 1; m <= 12; m++) expect(inWindow(m, { from: 1, to: 12 })).toBe(true);
  });
  it('잘못된 달은 오류', () => {
    expect(() => inWindow(13, { from: 1, to: 2 })).toThrow();
  });
});

describe('monthLabel', () => {
  it('10 → 10월', () => expect(monthLabel(10)).toBe('10월'));
});
