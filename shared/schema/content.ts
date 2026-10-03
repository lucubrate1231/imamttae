/**
 * 앱 데이터 규칙(zod). 데이터 파이프라인과 테스트가 같은 규칙을 씁니다.
 * 앱 실행 코드는 타입만 가져다 쓰므로(import type) 앱 무게에는 영향이 없습니다.
 */
import { z } from 'zod';
import { SCENE_TYPES } from '../../src/domain/sceneTypes';

const sceneTypeIds = SCENE_TYPES.map((t) => t.id) as [string, ...string[]];

export const LatLng = z.object({
  lat: z.number().min(33.0).max(38.7),
  lng: z.number().min(124.5).max(132.0),
});

/** 사진은 브런치(카카오) 사진 서버 주소만 허용 */
export const PhotoUrl = z
  .string()
  .url()
  .refine((u) => /^https:\/\/(t1\.daumcdn\.net|t1\.kakaocdn\.net|img1\.daumcdn\.net)\//.test(u), '허용되지 않은 사진 주소');

export const Photo = z.object({
  src: PhotoUrl,
  cap: z.string().default(''),
  w: z.number().int().nonnegative(),
  h: z.number().int().nonnegative(),
  /** 3:2로 자를 때 중심(CSS object-position), 예: '50% 60%' */
  focus: z.string().regex(/^\d{1,3}% \d{1,3}%$/).optional(),
  /** 수평 보정 각도(도). 원본은 그대로 두고 앱에서 돌려 보여 줍니다 */
  rotate: z.number().min(-10).max(10).optional(),
});

const IsoDate = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'YYYY-MM 또는 YYYY-MM-DD');
const Month = z.number().int().min(1).max(12);
const Review = z.enum(['draft', 'confirmed']);

/** 이야기 장면: 브런치 발행본에서 만든 장면 */
export const StoryScene = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,80}$/),
  kind: z.literal('story'),
  brunchNo: z.number().int().positive(),
  brunchUrl: z.string().url().startsWith('https://brunch.co.kr/@'),
  name: z.string().min(1).max(30),
  region: z.string().min(1).max(20),
  types: z.array(z.enum(sceneTypeIds)).min(1).max(3),
  visited: IsoDate,
  best: z.object({ from: Month, to: Month, note: z.string().max(40).default('') }),
  oneLiner: z.string().min(1).max(60),
  /** 작가 글 대목: 브런치 원문 그대로여야 함(계약 테스트로 확인) */
  excerpt: z.string().min(1).max(400),
  photos: z.array(Photo).min(1).max(6),
  spot: LatLng,
  dest: LatLng.extend({ name: z.string().min(1).max(40), kind: z.enum(['parking', 'trailhead', 'entrance']) }),
  review: z.object({ best: Review, dest: Review, oneLiner: Review, types: Review }),
  contestEntry: z.boolean().default(false),
  hidden: z.boolean().default(false),
  /** 작가 확인 때 볼 메모(앱에는 안 보임) */
  notes: z.string().max(300).optional(),
});

/** 준비 중 장면: 저장글. 이름과 다녀온 날, 대표 위치만 (사진·본문 없음) */
export const PlaceholderScene = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{3,80}$/),
    kind: z.literal('placeholder'),
    name: z.string().min(1).max(30),
    visited: IsoDate,
    spot: LatLng,
  })
  .strict();

export const Scene = z.discriminatedUnion('kind', [StoryScene, PlaceholderScene]);

export const ContentFile = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  scenes: z.array(Scene),
});

export type StoryScene = z.infer<typeof StoryScene>;
export type PlaceholderScene = z.infer<typeof PlaceholderScene>;
export type Scene = z.infer<typeof Scene>;
export type ContentFile = z.infer<typeof ContentFile>;
