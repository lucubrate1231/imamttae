/**
 * 사진 움직임 계산(비교안, 10/3 사용자 요청) — 화면 없는 순수 함수
 * - pan: 옆으로 긴 사진을 3:2 상자 안에서 천천히 좌우로 밉니다. from·to는 사진 폭에 대한 % (translateX 값)
 * - zoom: 그 밖의 사진은 초점을 중심으로 아주 살짝 확대합니다
 * 어느 쪽이든 마지막 모습은 지금 화면(초점 기준 3:2 자르기)과 같습니다.
 */
export interface PhotoShape {
  w: number;
  h: number;
  focus?: string;
  rotate?: number;
}

export type KenBurns = { mode: 'pan'; ar: number; from: number; to: number } | { mode: 'zoom'; origin: string };

/** 이보다 옆으로 길어야 밀기(3:2 상자에서 사진 폭의 7% 넘게 숨는 사진) */
const PAN_MIN_RATIO = 1.62;

export function kenBurnsPlan(p: PhotoShape, box = 1.5): KenBurns {
  const origin = p.focus ?? '50% 50%';
  if (!p.w || !p.h || p.rotate) return { mode: 'zoom', origin };
  const ar = p.w / p.h;
  if (ar < PAN_MIN_RATIO) return { mode: 'zoom', origin };
  const hidden = (1 - box / ar) * 100; // 3:2 상자 밖으로 숨는 폭(사진 폭의 %)
  const fx = p.focus ? Number(p.focus.split('%')[0]) / 100 : 0.5;
  const round = (n: number) => Math.round(n * 100) / 100 || 0; // -0 → 0
  const to = round(-hidden * fx);
  const from = fx >= 0.5 ? 0 : round(-hidden); // 초점에서 더 먼 쪽 끝에서 출발
  return { mode: 'pan', ar, from, to };
}
