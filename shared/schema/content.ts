/**
 * 앱 데이터 규칙(zod). 데이터 파이프라인과 테스트가 같은 규칙을 씁니다.
 * 앱 실행 코드는 타입만 가져다 쓰므로(import type) 앱 무게에는 영향이 없습니다.
 */
import { z } from 'zod';
import { SCENE_TYPES, type SceneTypeId } from '../../src/domain/sceneTypes';

const sceneTypeIds = SCENE_TYPES.map((t) => t.id) as [SceneTypeId, ...SceneTypeId[]];

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
  /**
   * 세부 풍경(D34): 그 장면의 구체적인 꽃·나무·풍경 이름(예: '수국', '메타세쿼이아', '습지'). 큰 갈래는 types.
   * 화면에는 아직 안 보임. 비공개 베타 준비 때 기획이 집계해 풍경 찾기에 올릴지 정함(PRD 3-7장). 작가 확인 대상.
   */
  details: z.array(z.string().min(1).max(12)).max(5).optional(),
  visited: IsoDate,
  /**
   * 가장 좋은 때. 다녀온 달이 이 안에 있으면 '제철', 아니면 '기록' 장면입니다(src/domain/sceneTier.ts).
   * 일 년 내내 볼 수 있거나 철을 말하기 어려운 장면은 비워 둘 수 있습니다.
   */
  best: z
    .object({
      from: Month,
      to: Month,
      /** 추천 시기. 카드 한 줄에 들어가게 시기만 짧게(예: '10월 중순~하순', '일 년 내내') */
      note: z.string().max(14).default(''),
      /** 이럴 때 더 좋아요: 날씨·때 조건(예: '맑은 날, 눈 온 뒤'). 장면 상세에만 보여 줌(10/3 3차 결정) */
      tip: z.string().min(1).max(20).optional(),
      /** 계절말(늦가을, 초여름 등). 날짜보다 먼저 보여 줘 '해마다 달라질 수 있음'을 덜 단정적으로 전함 */
      season: z.string().min(1).max(8).optional(),
    })
    .optional(),
  oneLiner: z.string().min(1).max(60),
  /** 작가 글 대목: 브런치 원문 그대로여야 함(계약 테스트로 확인) */
  excerpt: z.string().min(1).max(400),
  photos: z.array(Photo).min(1).max(6),
  spot: LatLng,
  dest: LatLng.extend({ name: z.string().min(1).max(40), kind: z.enum(['parking', 'trailhead', 'entrance']) }),
  review: z.object({ best: Review, dest: Review, oneLiner: Review, types: Review }),
  /** 글 제목의 '몇 번째 여행'(앱 데이터를 만들 때 붙임) */
  trip: z.string().max(30).optional(),
  contestEntry: z.boolean().default(false),
  hidden: z.boolean().default(false),
  /**
   * 입장료·운영 시간 확인 안내를 붙일 장면(민간 정원·유료 수목원 등, D4). 없으면 false로 봅니다.
   * 데이터에는 표시만 둡니다. 안내 문구와 자리는 화면 쪽(design-guide)에서 정합니다.
   */
  checkAdmission: z.boolean().optional(),
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
