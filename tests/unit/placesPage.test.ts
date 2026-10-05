import { describe, expect, it } from 'vitest';
import { placesPageData, readPicked } from '../../pipeline/places/pageData';

/** 좌표 확인 페이지를 미리보기 사이트(공개)에 올림 — 콘텐츠 세션(클라우드)에서 이어서 하려고(10/5 사용자) */
const drafts = [
  { id: 's-1', kind: 'story', name: '내장산 우화정', region: '전북 정읍', brunchUrl: 'https://brunch.co.kr/@x/1', types: ['danpung'], photos: [{ src: 'p1.jpg' }], spot: { lat: 35.1, lng: 126.9 }, dest: { name: '주차장', lat: 35.1, lng: 126.9 }, coordSource: 'kakao-search', note: '작가 내부 메모' },
  { id: 's-2', kind: 'story', name: '숨긴 곳', region: '어딘가', hidden: true, photos: [] },
  { id: 'p-3', kind: 'placeholder', name: '준비 중', region: '어딘가' },
];

describe('placesPageData', () => {
  const data = placesPageData(drafts, [{ id: 's-1', name: '내장산 우화정', region: '전북 정읍', spot: null, parking: [] }], { 's-1': { spot: { lat: 1, lng: 2, source: 'manual', ref: null } } });
  it('이야기 장면만(숨긴 곳·준비 중 빼고), 이름·지역·글·사진만', () => {
    expect(data.scenes).toEqual([{ id: 's-1', name: '내장산 우화정', region: '전북 정읍', brunchUrl: 'https://brunch.co.kr/@x/1', types: ['danpung'], photo: 'p1.jpg' }]);
  });
  it('카카오에서 찾은 좌표와 작가 내부 메모는 넣지 않음(공개 사이트)', () => {
    const text = JSON.stringify(data);
    expect(text).not.toContain('35.1');
    expect(text).not.toContain('kakao-search');
    expect(text).not.toContain('작가 내부 메모');
  });
  it('후보와 지금까지 확인한 값(seed)을 함께', () => {
    expect(data.candidates).toHaveLength(1);
    expect(Object.keys(data.seed)).toEqual(['s-1']);
  });
});

describe('readPicked: 붙여 넣은 결과(복사 형식)도, 예전 파일도 읽음', () => {
  it('복사 형식 { format, picked }', () => {
    expect(readPicked('{"format":"imamttae-places/1","picked":{"s-1":{}}}')).toEqual({ 's-1': {} });
  });
  it('예전 파일(장면 번호가 바로 열쇠)', () => {
    expect(readPicked('{"s-1":{}}')).toEqual({ 's-1': {} });
  });
});
