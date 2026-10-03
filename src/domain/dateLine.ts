/**
 * 작가가 글 맨 위에 쓰는 '다녀온 날' 줄을 읽습니다.
 * 예: "2019년 7월 29일", "2019. 10. 12", "20년 6월 4일~5일(1박2일)", "22년 8월 2.3.4일"
 * 원문 오타 '넌·녈·널'도 '년'으로 읽습니다.
 */
export interface VisitDate {
  year: number;
  month: number;
  day?: number;
  endMonth?: number;
  endDay?: number;
}

const HEAD = /^\s*(?:20)?(\d{2})\s*(?:[년넌녈널]|\.)\s*(\d{1,2})\s*(?:월|\.)\s*/;

export function parseVisitDate(line: string): VisitDate | null {
  const m = HEAD.exec(line);
  if (!m) return null;
  const year = 2000 + Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const out: VisitDate = { year, month };
  const rest = line.slice(m[0].length);

  // "4일~5일", "25~26일", "2.3.4일", "5일 - 12월 6일", "12"
  const days = /^(\d{1,2})(?:\s*일)?((?:\s*[.~\-–]\s*(?:\d{1,2}\s*월\s*)?\d{1,2}(?:\s*일)?)*)/.exec(rest);
  if (!days || !days[1]) return out;
  const day = Number(days[1]);
  if (day < 1 || day > 31) return out;
  out.day = day;
  const tail = days[2] ?? '';
  if (tail.trim()) {
    const parts = [...tail.matchAll(/(?:(\d{1,2})\s*월\s*)?(\d{1,2})/g)];
    const last = parts[parts.length - 1];
    if (last) {
      const endDay = Number(last[2]);
      const endMonth = last[1] ? Number(last[1]) : undefined;
      if (endDay >= 1 && endDay <= 31) {
        if (endMonth !== undefined && endMonth >= 1 && endMonth <= 12) out.endMonth = endMonth;
        out.endDay = endDay;
      }
    }
  }
  return out;
}

/** 본문 조각(문단 p, 소제목 h2, 구분선 hr, 사진 img …) */
export interface BodyItem {
  readonly t: string;
  readonly text?: string;
}

/** 첫 소제목 전 문단에서 날짜 줄을 찾고, 없으면 앞쪽 문단 6개에서 한 번 더 찾습니다. */
export function findDateLine(items: readonly BodyItem[]): string | null {
  for (const it of items) {
    if (it.t === 'h2') break;
    if (it.t === 'p' && it.text && parseVisitDate(it.text)) return it.text;
  }
  for (const it of items.filter((x) => x.t === 'p').slice(0, 6)) {
    if (it.text && parseVisitDate(it.text)) return it.text;
  }
  return null;
}
