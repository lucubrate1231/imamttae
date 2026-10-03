/** 달 계산. 이번 달은 휴대폰 시간대와 상관없이 한국 날짜로 정합니다. */
export type Month = number; // 1~12

export function monthInSeoul(now: Date = new Date()): Month {
  const m = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(now);
  return Number(m);
}

export interface MonthWindow {
  from: Month;
  to: Month;
}

function assertMonth(m: number): void {
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new Error(`잘못된 달: ${m}`);
}

/** 기간(from~to) 안에 그 달이 들어가는가. 12월~2월처럼 해를 넘는 기간도 처리합니다. */
export function inWindow(month: Month, w: MonthWindow): boolean {
  assertMonth(month);
  assertMonth(w.from);
  assertMonth(w.to);
  return w.from <= w.to ? month >= w.from && month <= w.to : month >= w.from || month <= w.to;
}

export function monthLabel(m: Month): string {
  return `${m}월`;
}

export const MONTHS: readonly Month[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
