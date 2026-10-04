# Codex 일 4 — 저장한 곳: 저장과 순서 계산 (F4, D24~D26)

> 맡은 사람: Codex · 가지: `codex/saved` · 정한 날: 2026-10-04(디자인 세션 F4 PR #24가 합쳐진 뒤, 개발 리드 Claude Code가 옮김)
> **시작 조건:** 일 3(풍경 찾기 묶음 계산) PR을 올린 뒤에 시작합니다. 한 번에 하나만 합니다.
> **기준 문서:** `docs/features/F4-올해-만난-풍경.md`(제목은 '저장한 곳')의 **'계산·저장에 쓰는 말'**과 완성 기준. 이 문서와 어긋나면 F4 문서가 맞습니다. 화면 글자는 design-guide 10장.
> 화면은 만들지 않습니다. 저장한 곳 탭·[다녀왔어요]·도장 순간·알림 카드 화면(Claude)이 이 함수들을 가져다 씁니다.
> **옛 범위는 쓰지 않습니다:** 풍경 13칸 도장판, '봤어요', D9·D11(10/4 D24~D26으로 바뀜).

## 왜 하나
일 2(`src/storage/wanted.ts`)는 '가고 싶은 곳' 목록만 저장합니다. 저장한 곳 탭에는 **저장한 날**, **다녀온 곳**(장소 도장, 해마다), **날짜 고치기·취소**, **알림 카드 닫기**가 더 필요합니다. 그리고 가고 싶은 곳을 **'지금 가기 좋은 순'**으로 놓는 계산이 필요합니다.

## 고칠 파일 (이 파일들만)
- 새로 만듦: `src/storage/saved.ts`, `tests/unit/saved.test.ts`, `src/domain/saved.ts`, `tests/unit/savedOrder.test.ts`
- `src/storage/wanted.ts`는 고치지 않습니다(옛 저장 값을 읽어 옮기기만, 아래 '옮기기').

## 만들 것 ① 저장 (함수 이름과 주고받는 값은 이대로. 바꿔야 하면 PR 설명에 적어 물어 주기)

```ts
// src/storage/saved.ts
import type { SceneTypeId } from '../domain/sceneTypes';
import { createSafeStore, type SafeStore } from './safeStorage';

/** 가고 싶은 곳 한 곳: 장면 id + 저장한 날(한국 날짜 'YYYY-MM-DD') */
export interface WantedPlace { sceneId: string; savedOn: string }
/** 다녀온 곳 한 곳(= 도장): 장면 id + 다녀온 날 + 그때의 장소 이름·대표 풍경(장면이 나중에 숨겨지거나 바뀌어도 도장이 남게) */
export interface Visit { sceneId: string; date: string; name: string; type: SceneTypeId }

export interface SavedStore {
  /** 이 브라우저에 저장이 되는가(F4-AC16). false여도 모든 함수는 메모리에서 작동 */
  readonly saved: boolean;

  // ── 가고 싶은 곳 — 일 2(WantedStore)와 같은 이름·뜻이라 장면 상세는 그대로 씀 ──
  isWanted(sceneId: string): boolean;
  /** 저장·빼기를 바꾸고 바뀐 뒤 상태(true = 저장됨). 저장하면 savedOn = 오늘 */
  toggleWanted(sceneId: string): boolean;
  /** 장면 id, 최근에 저장한 것이 앞 */
  wanted(): string[];
  /** 저장한 날까지, 최근에 저장한 것이 앞 */
  wantedPlaces(): WantedPlace[];

  // ── 다녀온 곳(도장) ──
  /** [다녀왔어요](F4-AC5): 오늘(또는 date) 날짜로 도장. 가고 싶은 곳에서 뺌. 그해에 이미 그 곳 도장이 있으면 새로 만들지 않고 있는 것을 돌려줌(F4-AC8) */
  markVisited(scene: { id: string; name: string; types: readonly SceneTypeId[] }, date?: string): Visit;
  /** 그해(기본 올해, 한국 날짜) 그 곳의 도장. 없으면 null — 장면 상세의 '○월 ○일에 다녀왔어요' 상자(F4-AC6) */
  visitOf(sceneId: string, year?: number): Visit | null;
  /** [날짜 변경](F4-AC6, D10): 그 도장의 날짜를 바꿈. 오늘보다 뒤면 거절. 바꾼 해에 그 곳 도장이 이미 있으면 거절. 성공하면 바뀐 도장, 거절하면 null */
  changeVisitDate(sceneId: string, year: number, newDate: string): Visit | null;
  /** '다녀온 기록 지우기'(F4-AC6): 도장을 지우고 가고 싶은 곳으로 돌려놓음(저장한 날은 처음 저장한 날, 모르면 오늘) */
  removeVisit(sceneId: string, year: number): void;
  /** 해마다 묶은 도장(F4-AC7·AC13): 최근 해가 앞, 해 안에서는 다녀온 날이 최근인 것이 앞. 올해에 도장이 없어도 올해 묶음은 넣지 않음(화면이 정함) */
  visitsByYear(): { year: number; visits: Visit[] }[];

  // ── 제철 알림 카드(F4-AC10) ──
  /** 그달('YYYY-MM')에 [×]로 닫았는가 */
  alertClosed(month: string): boolean;
  /** 그달에 닫음(다음 달에는 다시 뜸) */
  closeAlert(month: string): void;
}

/** store: 휴대폰 저장소(테스트에서는 가짜), now: 지금 시각(테스트에서 날짜를 정하려고) */
export function createSavedStore(store?: SafeStore, now?: () => Date): SavedStore;
```

## 만들 것 ② 순서 계산

```ts
// src/domain/saved.ts
import type { Scene, StoryScene } from '../../shared/schema/content';
import type { Month } from './month';

/** 가고 싶은 곳 줄 하나의 상태(F4-AC2 상태 한 줄): 지금 좋아요 · N월까지 / 언제나 좋아요 / 곧 · N월부터 / N월부터 / 추천 시기 없음 / 볼 수 없음 */
export type SavedStatus =
  | { kind: 'now'; until: Month }     // 오늘이 추천 시기 안 — until = 추천 시기가 끝나는 달
  | { kind: 'always' }                // 일 년 내내
  | { kind: 'soon'; from: Month }     // 추천 시기가 다음 달에 시작
  | { kind: 'later'; from: Month }    // 그 밖: 추천 시기가 빨리 오는 순
  | { kind: 'none' }                  // 추천 시기가 없는 장면(데이터 규칙상 비워 둘 수 있음, 10/4 예: s-065-amisan-ridge). 화면은 상태 한 줄을 비움
  | { kind: 'missing' };              // 장면이 숨겨지거나 없어짐(F4-AC12)

export interface SavedRow { sceneId: string; scene: StoryScene | null; status: SavedStatus }

/** 가고 싶은 곳을 '지금 가기 좋은 순'으로(F4 '계산·저장에 쓰는 말') */
export function savedOrder(scenes: readonly Scene[], wantedIds: readonly string[], today: Month): SavedRow[];

/** 제철 알림 카드(F4-AC10): 가고 싶은 곳 중 오늘이 추천 시기 안인 곳(savedOrder의 'now'와 같은 순서). 없으면 빈 배열 */
export function alertScenes(scenes: readonly Scene[], wantedIds: readonly string[], today: Month): StoryScene[];
```

## 규칙
### 저장
- **한국 날짜:** 날짜와 '올해'는 휴대폰 시간대와 상관없이 한국 날짜로 정합니다(`monthInSeoul`처럼 `Asia/Seoul`). 예: 한국 시간 1월 1일 0시 5분이면 새해입니다.
- **한 곳 한 해 도장 하나(F4-AC8):** 같은 장소는 한 해에 도장이 하나입니다. 다음 해에 다시 다녀오면 그해의 새 도장이 생깁니다(그 전에 다시 저장했다면 가고 싶은 곳에서 빠짐).
- **해마다 묶기:** 다녀온 날의 연도로 묶습니다. 날짜를 지난해로 고치면 그해 묶음으로 옮겨집니다(그해에 그 곳 도장이 이미 있으면 거절).
- **새해(F4-AC13):** 가고 싶은 곳은 그대로 남습니다. 도장은 지우지 않고 해마다 묶여 있을 뿐입니다.
- **대표 풍경:** `types[0]`(F4 '대표 풍경'). 도장에 그때의 이름과 함께 적어 둡니다.
- **저장이 막혀도(F4-AC16):** 사생활 보호 모드, 공간 부족, 깨진 값이 있어도 예외를 던지지 않습니다. `saved`는 false, 함수는 메모리에서 작동합니다.
  - 일 2 검토 의견: 깨진 값(판 번호가 없거나 모양이 틀림)은 **빈 수첩으로 덮어쓰고 저장을 이어 갑니다**. 나중 판(`v: 2` 이상)만 덮어쓰지 않습니다.
- **남아 있기(F4-AC14):** 새로 만든 `createSavedStore`(새로고침 흉내)도 앞에서 저장한 것을 그대로 읽습니다.
- **저장 모양:** 저장소 열쇠 하나(`saved`)에 `{ v: 1, wanted: WantedPlace[], visits: Visit[], alertClosed: string[] }`. `alertClosed`는 최근 12달치만 남겨도 됩니다.
- **옮기기:** `saved` 열쇠가 없고 일 2의 `wanted` 열쇠(`{ v: 1, ids }`)가 있으면, 그 목록을 가고 싶은 곳으로 옮깁니다(저장한 날은 모르므로 옮기는 날). 옮긴 뒤 `wanted` 열쇠는 그대로 둡니다(되돌릴 수 있게).

### 순서(`savedOrder`) — F4 '지금 가기 좋은 순'
1. **지금**(오늘이 추천 시기 안, 일 년 내내가 아닌 장면): 추천 시기가 **먼저 끝나는 곳** 먼저, 같으면 이름순(D23과 같은 규칙).
2. **일 년 내내**(`isYearRound`): 이름순.
3. **곧**(추천 시기가 다음 달에 시작): 이름순.
4. **그 밖**: 추천 시기가 **빨리 오는 순**(다음 달부터 가까운 시작 달), 같으면 이름순.
5. **추천 시기 없음**(`none`): 이름순. *(10/4 개발 리드 결정 — Codex 질문으로 처음 문서의 빈칸을 채움: 'later'는 시작 달이 꼭 있어야 해서 따로 둠)*
6. **볼 수 없음**(데이터에 없거나 `hidden`, 또는 준비 중 장면): 맨 뒤, 저장한 순서대로(`wantedIds` 순서).
- 해를 넘는 추천 시기(예: 12~2월)도 맞게 셉니다(`inWindow`).
- `until`·`from`은 화면의 '10월까지'·'11월부터'에 씁니다.

## 끝났다고 보는 조건
1. 테스트를 먼저 쓰고, 구현 전에 **실패하는 것을 확인**합니다(PR 설명에 실패했던 테스트 수).
2. 위 규칙마다 테스트가 있습니다. 날짜는 `now`로 정합니다(12월 31일 23시 59분 → 1월 1일 0시 1분, 한국 시간). 순서는 실제 앱 데이터(`public/data/scenes.json`)로도 하나 확인하되, 장면 수를 숫자로 박지 않습니다.
3. `npm run check`와 `npm run e2e`가 통과합니다.
4. PR 설명은 쉬운 한국어로 ① 무엇을 왜 ② 해당 완성 기준(F4-AC2·5·6·7·8·10·12·13·14·16) ③ 확인할 곳(테스트 이름 목록).
5. AGENTS.md의 'Codex가 맡고 있는 것' 칸을 일 4로 바꿉니다(자기 칸만).

## 건드리지 않을 것
- 화면: `src/app.ts`, `src/ui/`, `src/main.ts`, `src/styles/`, `index.html`, `_review/`, `src/review/`, `tests/e2e/`, `tests/dom/`
- 데이터와 규칙: `content/`, `pipeline/`, `public/data/`, `shared/schema/`
- `src/storage/wanted.ts`, `src/domain/find.ts`(일 3), `src/domain/home.ts`(Claude)
- `package.json`, `package-lock.json`
- `CLAUDE.md`, 그리고 AGENTS.md의 'Claude가 맡고 있는 것'·'Cowork 세션들이 맡고 있는 것' 칸
