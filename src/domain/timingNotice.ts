/**
 * 해마다 달라지는 장면 안내 (10/3 사용자 요청)
 * 꽃·단풍·억새·눈은 그해 기온과 날씨에 따라 1~2주씩 달라집니다.
 * '가장 좋은 때'를 단정하지 않도록, 이런 장면에는 올해 소식을 확인하라는 안내를 붙입니다.
 */
import type { SceneTypeId } from './sceneTypes';

/**
 * 올해 소식 찾아보기 검색 방법(10/3 6차 코멘트)
 * - map: 장소가 아니라 '누른 해 + ○○지도'(예: 2026 단풍지도). 꽃·단풍은 전국 지도로 보는 게 맞음
 * - place: '장소 + 키워드'(예: 발왕산 상고대 눈). 눈은 그곳 CCTV·눈 소식이 나와서 장소가 맞음
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
}

const BLOOM: TimingNotice = {
  keyword: '개화',
  search: { kind: 'map', word: '꽃지도' },
  short: '꽃 피는 시기는 해마다 달라져요',
  text: '꽃 피는 때는 해마다 1~2주씩 달라져요. 떠나기 전 올해 개화 소식을 확인하세요.',
};
const NOTICES: Partial<Record<SceneTypeId, TimingNotice>> = {
  maehwa: BLOOM,
  beotkkot: { ...BLOOM, search: { kind: 'map', word: '벚꽃지도' } },
  jindallae: BLOOM,
  yeoreumkkot: BLOOM,
  kkotmureut: BLOOM,
  danpung: { keyword: '단풍', search: { kind: 'map', word: '단풍지도' }, short: '단풍 시기는 해마다 달라져요', text: '단풍 드는 때는 해마다 1~2주씩 달라져요. 떠나기 전 올해 단풍 소식을 확인하세요.' },
  eoksae: { keyword: '억새', search: { kind: 'place', word: '억새' }, short: '억새 시기는 해마다 달라져요', text: '억새가 가장 좋은 때는 해마다 조금씩 달라져요. 떠나기 전 올해 소식을 확인하세요.' },
  seolgyeong: { keyword: '눈', search: { kind: 'place', word: '눈' }, short: '눈이 와야 볼 수 있어요', text: '눈이 와야 볼 수 있는 풍경이에요. 떠나기 전 눈 소식과 길 상황(빙판·통제)을 확인하세요.' },
};

/** 종류 목록에서 앞의 것(대표 종류)부터 보고, 안내가 있는 첫 종류의 안내를 돌려줍니다 */
export function timingNotice(types: readonly SceneTypeId[]): TimingNotice | null {
  for (const t of types) {
    const n = NOTICES[t];
    if (n) return n;
  }
  return null;
}

/** 올해 소식 찾아보기 링크(네이버 검색)와 글자. now는 누른 때(해를 정함) */
export function newsLink(name: string, n: TimingNotice, now: Date = new Date()): { url: string; label: string } {
  const { kind, word } = n.search;
  const q = kind === 'map' ? `${now.getFullYear()} ${word}` : name.includes(word) ? name : `${name} ${word}`;
  const label = kind === 'map' ? `올해 ${word} 찾아보기 ›` : `올해 ${n.keyword} 소식 찾아보기 ›`;
  return { url: `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`, label };
}
