# Codex 일 3 — 풍경 찾기: 볼 수 있는 때·고르기 묶음·목록 순서 (F3, D16·D17·D22·D23)

> 맡은 사람: Codex · 가지: `codex/find-groups` · 정한 날: 2026-10-04(기획 결정 → 개발 리드 Claude Code가 옮김)
> **시작 조건:** 일 1(PR #13)이 main에 합쳐지고, 일 2(가고 싶어요 저장) PR을 올린 뒤에 시작합니다. 한 번에 하나만 합니다.
> **기준 문장:** `docs/features/F3-풍경-찾기.md`의 **'계산에 쓰는 말'**과 **'정함'**(PR #17, main에 있음). 이 문서와 어긋나면 F3 문서가 맞습니다.
> 화면은 만들지 않습니다. 풍경 찾기 화면(Claude)이 이 함수들을 가져다 씁니다.

## 왜 하나
일 1의 `monthsForType`은 작가 부부가 다녀온 곳의 **다녀온 달**도 모아서, 억새·갈대가 '3·8월'처럼 나옵니다. 기획 결정(D16)은 **추천 시기 기준**입니다.
또 고르기 화면을 'N월에 좋은 풍경 / 언제나 / 다른 때'로 묶는 계산(D22)과, 목록의 '지금 제철' 묶음 안 순서(D23)가 새로 정해졌습니다.

## 고칠 파일 (이 파일들만)
- 고침: `src/domain/find.ts`, `tests/unit/find.test.ts`
- `src/domain/sceneTier.ts`(`isYearRound`), `src/domain/month.ts`(`inWindow`, `MONTHS`), `src/domain/sceneTypes.ts`(`SCENE_TYPES` = '표 순서')는 가져다 씁니다.

## 만들 것 (함수 이름과 주고받는 값은 이대로. 바꿔야 하면 PR 설명에 적어 물어 주기)

```ts
// src/domain/find.ts 에 더함

/** 풍경의 볼 수 있는 때(D16·D17) */
export type TypeWhen =
  | { kind: 'always' }                        // 언제나
  | { kind: 'range'; from: Month; to: Month } // 예: 10~11, 해를 넘기면 11~2
  | { kind: 'none' };                         // 추천 시기가 있는 장면이 없음(이야기가 없는 풍경 포함)

export function typeWhen(scenes: readonly FindInput[], type: SceneTypeId): TypeWhen;

/** 이번 달과 볼 수 있는 때: 범위 안이면 now, 다음 달에 시작하면 soon, 그 밖은 later */
export function whenStatus(w: TypeWhen, month: Month): 'now' | 'soon' | 'later' | 'always' | 'none';

/** 고르기 화면 묶음(D22) */
export interface TypeGroups {
  /** N월에 좋은 풍경: count = 이번 달이 추천 시기에 드는 장면 수(일 년 내내 장면은 세지 않음) */
  good: { type: SceneTypeId; count: number }[];
  /** 언제나 볼 수 있는 풍경 */
  always: SceneTypeId[];
  /** 다른 때 풍경 */
  other: SceneTypeId[];
  /** 이야기가 아직 없는 풍경(F3-AC5, 흐리게) */
  empty: SceneTypeId[];
}
export function typeGroups(scenes: readonly FindInput[], month: Month): TypeGroups;
```

- **`monthsForType`은 지웁니다.** `typeWhen`으로 바꿉니다(화면에서 아직 쓰지 않음). 테스트도 함께 정리합니다.
- **`findScenes`의 제철 순서를 고칩니다(D23).** 아래 '목록 순서'.
- '장면'은 늘 **발행된 이야기(`kind === 'story'`)이고 숨기지 않은 것**만 셉니다(일 1과 같음).

## 규칙
### 언제나 풍경(D8·D17)
- 그 풍경 장면의 **절반 넘게**가 일 년 내내(`isYearRound`)면 `{ kind: 'always' }`. 분모는 그 풍경의 장면 전체입니다.
  - 예(83곳): 일출·낙조 13곳 중 12곳 → 언제나. 바다 절경 8곳 모두 → 언제나.
  - '모두일 때만'으로 하면 일출·낙조가 상고대 1곳 때문에 '11~2월'로 나와서 틀립니다.

### 볼 수 있는 때 범위(D16)
- 언제나 풍경이 아니면 **일 년 내내 장면을 빼고**, 남은 장면의 **추천 시기(`best.from~to`)를 합친 달**로 범위 하나를 만듭니다. 다녀온 달은 쓰지 않습니다. 추천 시기가 없는 장면은 뺍니다.
  - 일 년 내내 장면을 빼지 않으면 운해·물안개(15곳 중 3곳이 일 년 내내)가 '언제나'로 나와서 틀립니다.
- 합친 달이 이어져 있으면 그 범위입니다. **해를 넘기면** `from: 11, to: 2`처럼 씁니다.
- 달이 **끊겨** 범위 하나로 못 쓰면, 장면이 가장 많이 몰린 범위를 씁니다(장면의 추천 시기가 그 범위와 겹치면 그 범위의 장면). 그래도 같으면 달 수가 많은 범위, 그것도 같으면 1월부터 가까운 범위. 지금 데이터엔 없지만 테스트로 지킵니다.
- 합친 달이 12달 전부면 `{ kind: 'always' }`로 봅니다.
- 남은 장면이 없으면 `{ kind: 'none' }`.
- 예(83곳): 단풍·은행 10~11, 억새·갈대 10~11(다른 계절 사진이어도 추천 시기 기준), 운해·물안개 4~11, 설경·상고대 11~2, 일출·낙조·바다 절경 언제나.

### 이번 달과의 관계(`whenStatus`)
- `always` → 'always', `none` → 'none'
- `range`: 이번 달이 범위 안(해를 넘는 범위 포함)이면 'now', **다음 달**이 범위의 시작 달이면 'soon', 그 밖은 'later'.
  - 예(10월): 단풍 10~11 → now, 설경 11~2 → soon, 매화 3 → later. 12월이면 11~2 → now, 1월이면 → now.

### 고르기 화면 묶음(D22)
- **good(N월에 좋은 풍경):** 언제나 풍경이 아니고, 이번 달이 추천 시기에 드는 장면이 **1곳 이상**인 풍경. `count`는 그 장면 수(**일 년 내내 장면은 세지 않음**). 많은 순, 같으면 표 순서(`SCENE_TYPES`).
  - 예(10월): 단풍·은행 9 → 운해·물안개 8 → 억새·갈대 2 → 계곡·폭포 1.
  - 일 년 내내 장면을 세면 신록·초원과 여름꽃이 1곳씩 10월에 들어와 버려서 틀립니다.
- **always:** 언제나 풍경, 표 순서. 예: 일출·낙조 → 바다 절경.
- **other(다른 때):** good·always·empty가 아닌 풍경. 볼 수 있는 때의 **시작 달이 다음 달부터 가까운 순**, 같으면 표 순서. `kind: 'none'`인 풍경(장면은 있으나 추천 시기가 모두 없음)은 맨 뒤.
  - 예(10월): 설경·상고대(11~2) → 매화·산수유(3) → 벚꽃 → 진달래·철쭉 → 신록·초원 → 여름꽃 → 꽃무릇·가을꽃.
- **empty:** 장면이 하나도 없는 풍경, 표 순서.
- 모든 풍경은 네 묶음 중 **정확히 한 곳**에 들어갑니다.

### 목록 순서(D23, `findScenes`)
- 제철 장면(`peak`) 중 **이번 달이 추천 시기 안인 장면('지금 제철' 묶음) 안에서는 추천 시기가 먼저 끝나는 곳 먼저**, 같은 달에 끝나면 이름순.
  - '먼저 끝남' = 이번 달부터 추천 시기 끝 달까지 남은 달 수가 적은 것(해를 넘는 기간 포함).
  - 예(10월 단풍): 남설악 주전골(10월 중순~하순, 10월에 끝남) → 내장산 우화정(10월 말~11월 초, 11월에 끝남).
- 그 밖의 제철 장면은 지금처럼 시작까지 가까운 순, 같으면 이름순.
- 작가 부부가 다녀온 곳(`record`) 순서와 `findScenes`가 돌려주는 모양은 그대로 둡니다. '일 년 내내' 장면을 회색으로 낮추지 않는 것(D8)은 화면이 `isYearRound`로 나눠서 합니다(계산은 그대로).

## 끝났다고 보는 조건
1. 테스트를 먼저 쓰고, 구현 전에 **실패하는 것을 확인**합니다(PR 설명에 실패했던 테스트 수).
2. 위 규칙마다 테스트가 있습니다. 위의 **83곳 예시**는 실제 앱 데이터(`public/data/scenes.json`)로 확인합니다. 데이터가 늘면 숫자가 바뀌므로, 숫자를 그대로 박기보다 "단풍·은행이 good의 첫째", "일출·낙조·바다 절경이 always" 같은 **규칙**으로 확인합니다.
3. `npm run check`와 `npm run e2e`가 통과합니다.
4. PR 설명은 쉬운 한국어로 ① 무엇을 왜 ② 해당 결정·완성 기준(D16·D17·D22·D23, F3-AC1·AC2·AC3) ③ 확인할 곳(테스트 이름 목록)을 적습니다.
5. AGENTS.md의 'Codex가 맡고 있는 것' 칸을 일 3으로 바꿉니다(자기 칸만).

## 건드리지 않을 것
- 화면: `src/app.ts`, `src/ui/`, `src/main.ts`, `src/styles/`, `index.html`, `_review/`, `src/review/`, `tests/e2e/`, `tests/dom/`
- 데이터와 규칙: `content/`, `pipeline/`, `public/data/`, `shared/schema/`
- `src/domain/router.ts`(일 1에서 끝남), `src/domain/home.ts`(Claude)
- `package.json`, `package-lock.json`
- `CLAUDE.md`, 그리고 AGENTS.md의 'Claude가 맡고 있는 것'·'Cowork 세션들이 맡고 있는 것' 칸
