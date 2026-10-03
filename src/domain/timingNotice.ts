/**
 * 해마다 달라지는 장면 안내 (10/3 사용자 요청)
 * 꽃·단풍·억새·눈은 그해 기온과 날씨에 따라 1~2주씩 달라집니다.
 * '가장 좋은 때'를 단정하지 않도록, 이런 장면에는 올해 소식을 확인하라는 안내를 붙입니다.
 */
import type { SceneTypeId } from './sceneTypes';

export interface TimingNotice {
  /** 검색 키워드(올해 소식 찾아보기) */
  keyword: string;
  text: string;
}

const BLOOM: TimingNotice = { keyword: '개화', text: '꽃 피는 때는 해마다 1~2주씩 달라져요. 떠나기 전 올해 개화 소식을 확인하세요.' };
const NOTICES: Partial<Record<SceneTypeId, TimingNotice>> = {
  maehwa: BLOOM,
  beotkkot: BLOOM,
  jindallae: BLOOM,
  yeoreumkkot: BLOOM,
  kkotmureut: BLOOM,
  danpung: { keyword: '단풍', text: '단풍 드는 때는 해마다 1~2주씩 달라져요. 떠나기 전 올해 단풍 소식을 확인하세요.' },
  eoksae: { keyword: '억새', text: '억새가 가장 좋은 때는 해마다 조금씩 달라져요. 떠나기 전 올해 소식을 확인하세요.' },
  seolgyeong: { keyword: '눈', text: '눈이 와야 볼 수 있는 풍경이에요. 떠나기 전 눈 소식과 길 상황(빙판·통제)을 확인하세요.' },
};

/** 종류 목록에서 앞의 것(대표 종류)부터 보고, 안내가 있는 첫 종류의 안내를 돌려줍니다 */
export function timingNotice(types: readonly SceneTypeId[]): TimingNotice | null {
  for (const t of types) {
    const n = NOTICES[t];
    if (n) return n;
  }
  return null;
}

export function newsSearchUrl(name: string, keyword: string): string {
  const q = name.includes(keyword) ? name : `${name} ${keyword}`;
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
}
