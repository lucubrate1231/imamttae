/**
 * 자연 풍경 13가지 (작가 확인 전 초안)
 * 10/3 사용자 결정으로 계곡·폭포, 바다 절경, 신록·초원을 더했습니다(10가지에 맞지 않는 장면이 17곳 있었음).
 */
export const SCENE_TYPES = [
  { id: 'maehwa', label: '매화·산수유' },
  { id: 'beotkkot', label: '벚꽃' },
  { id: 'jindallae', label: '진달래·철쭉' },
  { id: 'yeoreumkkot', label: '여름꽃' },
  { id: 'kkotmureut', label: '꽃무릇·가을꽃' },
  { id: 'danpung', label: '단풍·은행' },
  { id: 'eoksae', label: '억새·갈대' },
  { id: 'unhae', label: '운해·물안개' },
  { id: 'ilchul', label: '일출·낙조' },
  { id: 'seolgyeong', label: '설경·상고대' },
  { id: 'gyegok', label: '계곡·폭포' },
  { id: 'bada', label: '바다 절경' },
  { id: 'sinrok', label: '신록·초원' },
] as const;

export type SceneTypeId = (typeof SCENE_TYPES)[number]['id'];

export function isSceneTypeId(s: string): s is SceneTypeId {
  return SCENE_TYPES.some((t) => t.id === s);
}
