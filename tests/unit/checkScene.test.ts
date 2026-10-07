import { describe, expect, it } from 'vitest';
import { checkScene } from '../../pipeline/scenes/check';
import type { Story } from '../../pipeline/brunch/normalize';
import sample from '../fixtures/scenes.sample.json';

const story: Story = {
  brunchNo: 5, title: '다섯 번째 여행 - 설악산', subtitle: '', url: 'https://brunch.co.kr/@caed5ea4c3d74d9/5', publishTime: 1, contentHash: 'h',
  dateLine: '2019. 10. 12', visit: { year: 2019, month: 10, day: 12 }, intro: [], cover: null, photoCount: 1, sections: [],
  items: [
    { t: 'p', text: '(테스트용 표본) 앞 문장. (테스트용 표본) 뒷 문장.' },
    { t: 'img', src: 'https://t1.daumcdn.net/brunch/service/user/sample.jpg', cap: '', w: 1200, h: 800 },
  ],
};
const good = () => structuredClone(sample.scenes[0]) as Record<string, unknown> & { excerpt: string; photos: { src: string }[]; dest: Record<string, unknown>; visited: string };

describe('checkScene: 장면 초안 검사', () => {
  it('표본은 문제 없음', () => {
    expect(checkScene(good(), story)).toEqual([]);
  });
  it('작가 글 대목이 원문과 한 글자라도 다르면 문제', () => {
    const s = good();
    s.excerpt = '(테스트용 표본) 앞 문장!';
    expect(checkScene(s, story).join()).toMatch(/원문/);
  });
  it('그 글에 없는 사진이면 문제', () => {
    const s = good();
    s.photos[0]!.src = 'https://t1.kakaocdn.net/brunch/service/user/other.jpg';
    expect(checkScene(s, story).join()).toMatch(/사진/);
  });
  it('가는 곳(주차장)이 장면에서 15km보다 멀면 문제(엉뚱한 곳 안내 방지)', () => {
    const s = good();
    s.dest = { name: '먼 주차장', lat: 37.5, lng: 127.0, kind: 'parking' };
    expect(checkScene(s, story).join()).toMatch(/15km/);
  });
  it('다녀온 날이 글의 날짜 줄과 다르면 문제', () => {
    const s = good();
    s.visited = '2019-11-12';
    expect(checkScene(s, story).join()).toMatch(/다녀온 날/);
  });
  it("추천 시기 달 범위를 '10~11월'로 적으면 문제, '10월~11월'·'10월 하순~11월 초'는 통과(D68)", () => {
    const s = good() as Record<string, unknown>;
    s.best = { from: 10, to: 11, note: '10~11월', season: '가을', tip: '7~8월엔 무궁화' };
    const issues = checkScene(s, story).join();
    expect(issues).toMatch(/best\.note/);
    expect(issues).toMatch(/best\.tip/);
    s.best = { from: 10, to: 11, note: '10월~11월', season: '가을', tip: '7월~8월엔 무궁화' };
    expect(checkScene(s, story)).toEqual([]);
    s.best = { from: 10, to: 11, note: '10월 하순~11월 초', season: '가을' };
    expect(checkScene(s, story)).toEqual([]);
  });
  it('데이터 규칙(zod) 위반도 알려 준다', () => {
    const s = good();
    s.types = ['차박'];
    expect(checkScene(s, story).length).toBeGreaterThan(0);
  });
});
