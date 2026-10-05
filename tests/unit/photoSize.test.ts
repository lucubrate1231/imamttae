// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { photoImg, sized } from '../../src/ui/dom';

/** #83: 첫 화면 카드가 브런치 원본 사진(1MB)을 그대로 받아 느린 휴대폰 인터넷에서 18초 — 화면 크기에 맞춘 사진으로 */
const SRC = 'https://t1.kakaocdn.net/brunch/service/user/i5bK/image/dcldU97FhFHnj3m28UJdltbzqUM.jpg';

describe('sized: 화면 폭에 맞춘 사진 주소(카카오 썸네일, 비율 그대로)', () => {
  it('폭만 정하고 높이는 비율대로, 화질 70', () => {
    expect(sized(SRC, 720)).toBe(`https://img1.daumcdn.net/thumb/R720x0.q70/?fname=${encodeURIComponent(SRC)}`);
  });
  it('브런치 사진이 아니면(앱 안 그림 등) 그대로', () => {
    expect(sized('./stamps/danpung.webp', 720)).toBe('./stamps/danpung.webp');
  });
});

describe('photoImg: 맨 처음 보이는 사진은 먼저 받음', () => {
  it('eager면 fetchpriority high, 아니면 lazy', () => {
    const first = photoImg({ src: SRC, cap: '', w: 1200, h: 800 } as never, '', { eager: true });
    expect(first.getAttribute('fetchpriority')).toBe('high');
    expect(first.getAttribute('loading')).toBe('eager');
    const later = photoImg({ src: SRC, cap: '', w: 1200, h: 800 } as never, '');
    expect(later.getAttribute('fetchpriority')).toBeNull();
    expect(later.getAttribute('loading')).toBe('lazy');
  });
});
