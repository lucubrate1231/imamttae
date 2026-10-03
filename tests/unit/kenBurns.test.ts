import { describe, expect, it } from 'vitest';
import { kenBurnsPlan } from '../../src/domain/kenBurns';

/**
 * 사진 움직임(비교안, 10/3 사용자 요청): 장면 상세의 지금 사진을 아주 천천히 움직여 생동감을 줌.
 * - 옆으로 긴 사진(작가 사진 대부분, 약 2.1:1)은 3:2로 자르면 양옆이 안 보임 → 천천히 좌우로 밀어 잘린 풍경을 보여 줌
 * - 그 밖(3:2에 가깝거나 세로)은 아주 살짝 확대
 * - 움직임은 사진의 초점(focus)에서 끝나서, 다 움직이고 나면 지금과 같은 구도가 됨
 */
describe('kenBurnsPlan: 사진마다 움직이는 방법', () => {
  it('옆으로 긴 사진(1400×640)은 좌우 밀기: 한쪽 끝에서 가운데(초점)로', () => {
    const k = kenBurnsPlan({ w: 1400, h: 640 });
    expect(k.mode).toBe('pan');
    if (k.mode !== 'pan') return;
    // 3:2 상자에 맞추면 사진 폭의 약 31%가 안 보임. 초점이 가운데면 왼쪽 끝(0%)에서 가운데(-15.7%)로
    expect(k.ar).toBeCloseTo(2.1875, 3);
    expect(k.from).toBe(0);
    expect(k.to).toBeCloseTo(-15.71, 1);
  });
  it('초점이 왼쪽이면 오른쪽 끝에서 출발해 초점에서 끝남(가장 먼 쪽에서 출발)', () => {
    const k = kenBurnsPlan({ w: 1400, h: 640, focus: '30% 50%' });
    if (k.mode !== 'pan') throw new Error('pan이어야 함');
    expect(k.from).toBeCloseTo(-31.43, 1);
    expect(k.to).toBeCloseTo(-9.43, 1);
  });
  it('초점이 오른쪽이면 왼쪽 끝에서 출발', () => {
    const k = kenBurnsPlan({ w: 1400, h: 640, focus: '80% 40%' });
    if (k.mode !== 'pan') throw new Error('pan이어야 함');
    expect(k.from).toBe(0);
    expect(k.to).toBeCloseTo(-25.14, 1);
  });
  it('3:2에 가까운 사진은 밀 여백이 거의 없어 살짝 확대(초점을 중심으로)', () => {
    expect(kenBurnsPlan({ w: 1200, h: 800 })).toEqual({ mode: 'zoom', origin: '50% 50%' });
    expect(kenBurnsPlan({ w: 1200, h: 760, focus: '50% 60%' })).toEqual({ mode: 'zoom', origin: '50% 60%' });
  });
  it('세로 사진도 살짝 확대', () => {
    expect(kenBurnsPlan({ w: 800, h: 1200 }).mode).toBe('zoom');
  });
  it('수평 보정(rotate)이 있는 사진은 보정 확대와 겹치지 않게 살짝 확대로', () => {
    expect(kenBurnsPlan({ w: 1400, h: 640, rotate: -2 }).mode).toBe('zoom');
  });
  it('크기 정보가 없으면 살짝 확대', () => {
    expect(kenBurnsPlan({ w: 0, h: 0 }).mode).toBe('zoom');
  });
});
