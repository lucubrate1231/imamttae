# Codex 일 1 — 풍경 찾기 계산 (F3)

> 맡은 사람: Codex · 가지: `codex/find-calc` · 정한 날: 2026-10-03(사용자 결정)
> 화면은 만들지 않습니다. 화면(`src/app.ts`, `src/ui/`)은 Claude가 이 함수들을 가져다 씁니다.

## 왜 Codex가 하나
풍경 찾기 화면에 필요한 계산(고르기, 정렬, 권역 나누기)은 화면 없이 단위 테스트만으로 완성할 수 있습니다.
Claude가 첫 화면(F1·F2)을 실제 앱으로 옮기는 동안, 같은 파일을 건드리지 않고 동시에 만들 수 있습니다.

## 고칠 파일 (이 파일들만)
- 새로 만듦: `src/domain/find.ts`, `tests/unit/find.test.ts`
- 고침: `src/domain/router.ts`, `tests/unit/router.test.ts` (풍경 찾기 주소에 권역 더하기)

## 만들 것 (함수 이름과 주고받는 값은 이대로. 바꿔야 하면 PR 설명에 적어 사용자에게 묻기)

```ts
// src/domain/find.ts
export type RegionId = 'gangwon' | 'gyeongsang' | 'jeolla' | 'chungcheong' | 'sudogwon';
export const REGIONS: readonly { id: RegionId; label: string }[]; // 강원 · 경상 · 전라 · 충청 · 수도권 (이 순서)

/** 장면의 region('경북 포항' 등) 첫 낱말로 권역을 정함. 모르는 지역은 null */
export function regionOf(region: string): RegionId | null;

/** 권역 칩: 장면이 있는 권역만, REGIONS 순서로, 장면 수와 함께 (F3-AC7) */
export function regionCounts(scenes: readonly FindInput[]): { id: RegionId; label: string; count: number }[];

/** 풍경 종류마다 이야기 수. 0이면 화면에서 흐리게 (F3-AC5) */
export function typeCounts(scenes: readonly FindInput[]): Record<SceneTypeId, number>;

/** 그 풍경을 볼 수 있는 달(달 띠 표시용, 오름차순) (F3-AC2) */
export function monthsForType(scenes: readonly FindInput[], type: SceneTypeId): Month[];

/** 풍경·권역으로 고른 장면을 제철 / 작가 부부가 다녀온 곳으로 나누고 정렬 (F3-AC2·AC3·AC4·AC7) */
export function findScenes<T extends FindInput>(
  scenes: readonly T[],
  opts: { type?: SceneTypeId | null; region?: RegionId | null; month: Month },
): { peak: T[]; record: T[] };

/** 계산에 필요한 장면 값만 (StoryScene이 이 모양을 만족함) */
export interface FindInput extends TierInput {
  kind: string; // 'story'만 고름. 준비 중('placeholder')은 빼기 (F3-AC4)
  hidden?: boolean; // true면 빼기
  region: string;
  types: readonly SceneTypeId[];
  name: string;
}
```

## 규칙
- **권역 나누기:** 강원 → 강원 / 경북·경남·부산·대구·울산 → 경상 / 전북·전남·광주 → 전라 / 충북·충남·대전·세종 → 충청 / 서울·경기·인천 → 수도권. 그 밖(제주 등)은 null. null 장면은 권역 칩 수에 넣지 않고, 권역을 골랐을 때도 나오지 않습니다. 지금 데이터(83곳 포함)에는 null이 없습니다.
- **고르기:** 발행된 이야기(`kind === 'story'`)이고 숨기지 않은 장면만. 풍경을 고르면 `types`에 그 풍경이 있는 장면, 권역을 고르면 그 권역 장면. 둘 다 고를 수 있습니다.
- **제철과 기록 나누기:** `src/domain/sceneTier.ts`의 `sceneTier`를 그대로 씁니다(새로 만들지 않기).
- **정렬(F3-AC3):** 제철 장면은 "고른 달부터 가장 좋은 때가 시작되기까지 남은 달 수" 오름차순. 고른 달이 이미 가장 좋은 때 안이면 0. 12월~2월처럼 해를 넘는 기간도 맞게. 같으면 이름 가나다순. 기록 장면은 "고른 달부터 다녀온 달까지 남은 달 수" 오름차순, 같으면 이름 가나다순. 결과는 언제 돌려도 같은 순서여야 합니다.
  - 예: 10월에 단풍을 고르면 → 설악 주전골(10월 중순 시작, 0) → 내장산(11월 시작, 1).
- **달력 계산은 기존 `src/domain/month.ts`(`inWindow`, `MONTHS`)를 씁니다.**

## 주소 (router.ts)
- 풍경 찾기 주소에 권역을 더합니다: `#/find`, `#/find/danpung`, `#/find/all/gangwon`, `#/find/danpung/gangwon`.
- `Route`의 find는 `{ name: 'find'; type: SceneTypeId | null; region: RegionId | null }`로 바꿉니다. 모르는 값은 null.
- `routeHref`도 위 모양으로 돌려줍니다(풍경 없이 권역만이면 `all`). 기존 주소(`#/find`, `#/find/danpung`)는 그대로 열려야 합니다.

## 끝났다고 보는 조건
1. 테스트를 먼저 쓰고, 구현 전에 **실패하는 것을 확인**합니다(PR 설명에 실패했던 테스트 수를 적기).
2. 위 규칙마다 테스트가 있습니다. 실제 앱 데이터(`public/data/scenes.json`)로도 하나 확인합니다. 이때 **장면 수를 숫자로 박지 않습니다**(데이터가 계속 늘어남. 열려 있는 데이터 PR이 55곳 → 83곳으로 늘림). 대신 "모든 장면의 권역이 null이 아니다", "권역 칩 수의 합 = 고를 수 있는 장면 수"처럼 규칙으로 확인합니다.
3. `npm run check`와 `npm run e2e`가 통과합니다.
4. PR 설명은 쉬운 한국어로 ① 무엇을 왜 ② 해당 완성 기준(F3-AC…) ③ 사용자가 확인할 곳(이번에는 화면이 없으니 "테스트 이름 목록")을 적습니다.

## 건드리지 않을 것
- 화면: `src/app.ts`, `src/ui/`, `src/main.ts`, `src/styles/`, `index.html`, `_review/`, `src/review/`, `tests/e2e/`
- 데이터와 규칙: `content/`, `pipeline/`, `public/data/`, `shared/schema/`
- `package.json`, `package-lock.json` (새 도구가 필요하면 사용자에게 먼저 묻기)
- `CLAUDE.md`, 그리고 AGENTS.md의 'Claude가 맡고 있는 것' 칸
