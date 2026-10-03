import { describe, expect, it } from 'vitest';
import { normalizeArticle, normalizePhotoUrl } from '../../pipeline/brunch/normalize';
import raw from '../fixtures/brunch-raw.sample.json';

describe('normalizeArticle: 브런치 글을 앱이 쓰기 좋은 모양으로 정리', () => {
  const s = normalizeArticle(raw);
  it('기본 정보(앞뒤 공백 제거)', () => {
    expect(s).toMatchObject({ brunchNo: 99, title: '아흔아홉 번째 여행 - 테스트 계곡', subtitle: '표본', contentHash: 'abc' });
  });
  it('날짜 줄을 찾아 다녀온 날로 읽는다(원문 오타 "넌"도)', () => {
    expect(s.dateLine).toBe('20넌 11월 3일~4일');
    expect(s.visit).toEqual({ year: 2020, month: 11, day: 3, endDay: 4 });
  });
  it('도입 문단은 날짜 줄을 빼고 첫 소제목 전까지', () => {
    expect(s.intro).toEqual(['(표본) 도입 문장입니다.']);
  });
  it('본문 순서 그대로: 문단·소제목·사진·사진 모음·동영상·구분선', () => {
    expect(s.items.map((i) => i.t)).toEqual(['p', 'p', 'hr', 'h2', 'p', 'img', 'gallery', 'video', 'h2']);
  });
  it('줄바꿈(br)은 \\n 으로', () => {
    expect(s.items[4]).toEqual({ t: 'p', text: '첫 줄\n둘째 줄' });
  });
  it('소제목 목록(h2, h3)', () => expect(s.sections).toEqual(['첫 소제목', '둘째 소제목']));
  it('사진: https + kakaocdn 으로 통일, 숫자 크기, 캡션 다듬기', () => {
    expect(s.items[5]).toEqual({ t: 'img', src: 'https://t1.kakaocdn.net/brunch/service/user/i5bK/image/a.jpg', cap: '계곡', w: 1400, h: 640 });
    expect(s.photoCount).toBe(3);
  });
  it('표지 사진', () => expect(s.cover).toBe('https://t1.kakaocdn.net/brunch/service/user/i5bK/image/cover.jpg'));
});

describe('normalizePhotoUrl', () => {
  it.each([
    ['http://t1.daumcdn.net/brunch/a.jpg', 'https://t1.kakaocdn.net/brunch/a.jpg'],
    ['https://t1.kakaocdn.net/brunch/a.jpg', 'https://t1.kakaocdn.net/brunch/a.jpg'],
    ['http://img1.daumcdn.net/thumb/x', 'https://img1.daumcdn.net/thumb/x'],
  ])('%s', (a, b) => expect(normalizePhotoUrl(a)).toBe(b));
});
