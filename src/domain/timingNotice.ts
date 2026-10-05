/**
 * 해마다 달라지는 장면 안내 (10/3 사용자 요청)
 * 꽃·단풍·억새·눈은 그해 기온과 날씨에 따라 1~2주씩 달라집니다.
 * '가장 좋은 때'를 단정하지 않도록, 이런 장면에는 올해 소식을 확인하라는 안내를 붙입니다.
 */
import type { SceneTypeId } from './sceneTypes';

/**
 * 올해 소식 찾아보기 검색 방법(10/3 6차 코멘트 → D40 구글, 맨 끝에 '시기')
 * - map: 장소가 아니라 '누른 해 + ○○지도 + 시기'(예: 2026 단풍지도 시기). 꽃·단풍은 전국 지도로 보는 게 맞음
 * - place: '장소 이름(풍경 말 빼고) + 누른 해 + 키워드 + 시기'(예: 발왕산 2026 눈 시기). 억새·갈대·눈은 그곳 소식이 맞음
 */
export type NewsSearch = { kind: 'map'; word: string } | { kind: 'place'; word: string };

export interface TimingNotice {
  /** 안내에 쓰는 키워드(개화, 단풍, 억새, 눈) */
  keyword: string;
  /** 올해 소식 찾아보기 검색 방법 */
  search: NewsSearch;
  /** 장면 상세에 쓰는 안내 */
  text: string;
  /** 카드에 쓰는 짧은 한 줄 */
  short: string;
  /** 장면 상세 '떠나기 전에 확인하세요' 카드의 시기 줄 안내(디자인 #61 — 뒤 문장은 카드 제목과 겹쳐 뺌) */
  line: string;
}

const BLOOM: TimingNotice = {
  keyword: '개화',
  search: { kind: 'map', word: '꽃지도' },
  short: '꽃 피는 시기는 해마다 달라져요',
  line: '꽃 피는 때는 해마다 1~2주씩 달라져요',
  text: '꽃 피는 때는 해마다 1~2주씩 달라져요. 떠나기 전 올해 개화 소식을 확인하세요.',
};
const NOTICES: Partial<Record<SceneTypeId, TimingNotice>> = {
  maehwa: BLOOM,
  beotkkot: { ...BLOOM, search: { kind: 'map', word: '벚꽃지도' } },
  jindallae: BLOOM,
  yeoreumkkot: BLOOM,
  kkotmureut: BLOOM,
  danpung: { keyword: '단풍', search: { kind: 'map', word: '단풍지도' }, short: '단풍 시기는 해마다 달라져요', line: '단풍 드는 때는 해마다 1~2주씩 달라져요', text: '단풍 드는 때는 해마다 1~2주씩 달라져요. 떠나기 전 올해 단풍 소식을 확인하세요.' },
  eoksae: { keyword: '억새', search: { kind: 'place', word: '억새' }, short: '억새 시기는 해마다 달라져요', line: '억새가 가장 좋은 때는 해마다 조금씩 달라져요', text: '억새가 가장 좋은 때는 해마다 조금씩 달라져요. 떠나기 전 올해 소식을 확인하세요.' },
  seolgyeong: { keyword: '눈', search: { kind: 'place', word: '눈' }, short: '눈이 와야 볼 수 있어요', line: '눈이 와야 볼 수 있고, 길이 얼거나 막힐 수 있어요', text: '눈이 와야 볼 수 있는 풍경이에요. 떠나기 전 눈 소식과 길 상황(빙판·통제)을 확인하세요.' },
};

/** 종류 목록에서 앞의 것(대표 종류)부터 보고, 안내가 있는 첫 종류의 안내를 돌려줍니다 */
export function timingNotice(types: readonly SceneTypeId[]): TimingNotice | null {
  for (const t of types) {
    const n = NOTICES[t];
    if (n) return n;
  }
  return null;
}

/**
 * 검색할 때 장면 이름 끝의 풍경 말을 뺍니다(D40). 예: '천리포수목원 봄 연못' → '천리포수목원'.
 * 구글 AI 개요는 장소 이름만 있어야 그 장소를 잘 찾습니다. 데이터 칸을 늘리지 않고 끝말 목록으로 뺍니다 —
 * 새 장면 이름에 다른 풍경 말이 붙으면 이 목록에 더합니다(tests/unit/timingNotice.test.ts).
 */
const SCENERY_WORDS = new Set(['봄', '여름', '가을', '겨울', '연못', '수국', '홍매화', '이끼정원', '둘레길', '상고대', '설경', '설화', '조망', '갈대', '갈대숲', '데크길', '억새', '억새평원']);
export function placeName(name: string): string {
  const words = name.trim().split(/\s+/);
  while (words.length > 1 && SCENERY_WORDS.has(words[words.length - 1]!)) words.pop();
  return words.join(' ');
}

const google = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** 입장료·운영 시간 찾아보기(D4 → D40 구글): '장소 이름 + 입장료 운영시간'. 금액·시간은 앱에 적지 않음(보는 때에 따라 틀려짐) */
export function admissionLink(name: string): string {
  return google(`${placeName(name)} 입장료 운영시간`);
}

/** 올해 소식 찾아보기 링크(구글 검색, D40)와 글자. now는 누른 때(해를 정함). label은 옛 링크(시안 v2), go는 카드 줄('›'는 줄 화살표가 대신) */
export function newsLink(name: string, n: TimingNotice, now: Date = new Date()): { url: string; label: string; go: string } {
  const { kind, word } = n.search;
  const year = now.getFullYear();
  // 갈대 장면은 종류가 '억새·갈대'(eoksae)라도 '갈대'로 찾음(D40)
  const w = kind === 'place' && name.includes('갈대') ? '갈대' : word;
  const q = kind === 'map' ? `${year} ${word} 시기` : `${placeName(name)} ${year} ${w} 시기`;
  const go = kind === 'map' ? `올해 ${word} 찾아보기` : `올해 ${n.keyword} 소식 찾아보기`;
  return { url: google(q), label: `${go} ›`, go };
}
