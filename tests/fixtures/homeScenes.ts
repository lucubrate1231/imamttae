/** 첫 화면 테스트용 장면 묶음(사진 주소는 데이터 규칙에 맞는 가짜) */
import type { ContentFile, PlaceholderScene, StoryScene } from '../../shared/schema/content';

const photo = { src: 'https://t1.daumcdn.net/brunch/service/user/test.jpg', cap: '', w: 1200, h: 800 };
const review = { best: 'confirmed', dest: 'confirmed', oneLiner: 'confirmed', types: 'confirmed' } as const;

export function story(id: string, o: Partial<StoryScene> & Pick<StoryScene, 'name' | 'visited'>): StoryScene {
  return {
    id,
    kind: 'story',
    brunchNo: 1,
    brunchUrl: 'https://brunch.co.kr/@caed5ea4c3d74d9/1',
    region: '강원 양양',
    types: ['danpung'],
    oneLiner: '한 줄 소개',
    excerpt: '작가 글 대목',
    photos: [photo],
    spot: { lat: 38.08, lng: 128.43 },
    dest: { name: '주차장', lat: 38.07, lng: 128.45, kind: 'parking' },
    review,
    contestEntry: false,
    hidden: false,
    ...o,
  };
}

export function placeholder(id: string, name: string, visited: string): PlaceholderScene {
  return { id, kind: 'placeholder', name, visited, spot: { lat: 35.05, lng: 129.08 } };
}

/**
 * 10월 기준
 * - 제철: 주전골(10월에 찍음, 10월만) · 내장산(11월에 찍음, 10~11월) · 백무동(9월에 찍음, 9~10월) · 오래된 주전골(10월에 찍음, 더 옛날)
 * - 작가 부부가 다녀온 곳: 바다(일 년 내내, 10월에 다녀옴)
 * - 준비 중: 태종대(10월에 다녀옴)
 * - 2월은 비어 있음(가까운 달: 1월 상고대, 3월 매화)
 */
export const HOME_SCENES: ContentFile = {
  version: 1,
  generatedAt: '2026-10-03T00:00:00+09:00',
  scenes: [
    story('s-naejang', { name: '내장산 우화정', visited: '2021-11-02', best: { from: 10, to: 11, note: '10월 말~11월 초' } }),
    story('s-baekmu', { name: '지리산 백무동 단풍', visited: '2020-09-28', best: { from: 9, to: 10, note: '9월 말~10월 중순' } }),
    story('s-jujeon', { name: '남설악 주전골', visited: '2022-10-15', best: { from: 10, to: 10, note: '10월 중순~하순' } }),
    story('s-jujeon-old', { name: '설악 대승폭포 단풍길', visited: '2019-10-10', best: { from: 10, to: 10, note: '10월 중순' } }),
    story('s-sea', { name: '동해 추암 촛대바위', visited: '2023-10-05', types: ['bada'], best: { from: 1, to: 12, note: '일 년 내내' } }),
    story('s-sanggodae', { name: '발왕산 상고대', visited: '2022-01-20', types: ['seolgyeong'], best: { from: 1, to: 1, note: '1월' } }),
    story('s-maehwa', { name: '광양 매화마을', visited: '2023-03-15', types: ['maehwa'], best: { from: 3, to: 3, note: '3월 중순' } }),
    story('s-hidden', { name: '숨긴 장면', visited: '2022-10-01', hidden: true, best: { from: 10, to: 10, note: '10월' } }),
    placeholder('p-taejong', '부산 태종대', '2023-10-26'),
  ],
};
