# Codex 일 2 — 내 수첩 저장 (F4, F2-AC2c)

> 맡은 사람: Codex · 가지: `codex/notebook` · 정한 날: 2026-10-03(사용자 결정: 일 1 다음, 가고 싶어요 저장도 Codex)
> 화면은 만들지 않습니다. 장면 상세의 '가고 싶어요'와 앞으로 만들 내 수첩 화면(Claude)이 이 함수들을 가져다 씁니다.
> 일 1(PR #13)과 고치는 파일이 겹치지 않으니, 일 1이 합쳐지기 전이라도 main에서 새 가지를 만들어 시작해도 됩니다.

## 왜 Codex가 하나
휴대폰에 도장과 '가고 싶은 곳'을 저장하는 일은 화면 없이 단위 테스트만으로 완성할 수 있습니다.
그동안 Claude는 장면 상세 화면을 만들고, '가고 싶어요'는 아래 `isWanted`·`toggleWanted` 두 함수 이름으로 미리 연결해 둡니다(그전까지는 화면을 닫으면 사라지는 임시 저장).

## 고칠 파일 (이 파일들만)
- 새로 만듦: `src/storage/notebook.ts`, `tests/unit/notebook.test.ts`
- `src/storage/safeStorage.ts`는 그대로 가져다 씁니다. 꼭 고쳐야 하면 PR 설명에 적어 묻기.

## 만들 것 (함수 이름과 주고받는 값은 이대로. 바꿔야 하면 PR 설명에 적어 사용자에게 묻기)

```ts
// src/storage/notebook.ts
import type { SceneTypeId } from '../domain/sceneTypes';
import { createSafeStore, type SafeStore } from './safeStorage';

/** 도장 하나: 풍경 종류, 찍은 날(한국 날짜 'YYYY-MM-DD'), 어느 장면에서 찍었는지(장면 없이 찍으면 없음) */
export interface Stamp { type: SceneTypeId; date: string; sceneId?: string }

export interface Notebook {
  /** F4-AC8: 이 브라우저에 저장이 되는가. false면 화면이 "이 브라우저에서는 도장이 저장되지 않아요"라고 알림. 그래도 아래 함수는 모두 작동(화면을 닫으면 사라질 뿐) */
  readonly saved: boolean;

  // ── 가고 싶어요 (F2-AC2c, F4-AC3) ──
  isWanted(sceneId: string): boolean;
  /** 담기·빼기를 바꾸고, 바뀐 뒤 상태를 돌려줌(true = 담음) */
  toggleWanted(sceneId: string): boolean;
  /** 담은 장면 id, 최근에 담은 것이 앞 */
  wanted(): string[];

  // ── 도장 (F4-AC1·AC2·AC6) ──
  /** 올해(한국 날짜 기준) 도장. 풍경마다 하나, 찍은 순서대로 */
  stamps(): Stamp[];
  /** 지난해들 도장: 해마다 묶어 최근 해가 앞 (F4-AC6 '지난해' 아래 접어 보관) */
  pastYears(): { year: number; stamps: Stamp[] }[];
  /** 오늘 날짜로 그 풍경 도장 찍기. 올해 이미 있으면 그대로 두고 그 도장을 돌려줌 */
  stamp(type: SceneTypeId, sceneId?: string): Stamp;
  /** 올해 그 풍경 도장 취소(잘못 찍었을 때, F4-AC2) */
  unstamp(type: SceneTypeId): void;

  // ── 다녀왔어요 (F4-AC3) ──
  /** 그 장면의 풍경 종류마다 도장을 찍고, 가고 싶은 곳에서 빼서 다녀온 곳으로 옮김 */
  markVisited(scene: { id: string; types: readonly SceneTypeId[] }): void;
  /** 다녀온 곳(장면 id와 한국 날짜), 최근 것이 앞 */
  visited(): { sceneId: string; date: string }[];
}

/** store: 휴대폰 저장소(테스트에서는 가짜), now: 지금 시각(테스트에서 날짜를 정하려고) */
export function createNotebook(store?: SafeStore, now?: () => Date): Notebook;
```

## 규칙
- **한국 날짜:** 날짜와 '올해'는 휴대폰 시간대와 상관없이 한국 날짜로 정합니다(`src/domain/month.ts`의 `monthInSeoul`처럼 `Asia/Seoul`). 예: 한국 시간 1월 1일 0시 5분이면 새해입니다.
- **새해(F4-AC6):** 새해가 되면 `stamps()`는 비고, 지난해 도장은 `pastYears()`로 갑니다. 지운 것이 아니라 보관입니다. 가고 싶은 곳과 다녀온 곳은 해가 바뀌어도 그대로 둡니다.
- **저장이 막혀도(F4-AC8):** 사생활 보호 모드, 저장 공간 부족, 깨진 값이 있어도 예외를 던지지 않습니다. 이때 `saved`는 false이고, 함수는 메모리에서 그대로 작동합니다.
  - `createSafeStore`는 실제로 써 보기 전까지 `available`이 true일 수 있습니다. 처음 만들 때 한 번 써 보는 등으로 `saved`를 정확히 정합니다.
- **남아 있기(F4-AC5):** 새로 만든 `createNotebook`(새로고침 흉내)도 앞에서 저장한 것을 그대로 읽습니다.
- **다녀왔어요(F4-AC3):** 장면의 풍경 종류가 여러 개면 **모두** 도장을 찍습니다(예: 계곡·폭포 + 단풍·은행). 이 부분은 사용자 확인 전 제안이니 PR 설명에 "모두 찍기로 했다"고 적어 주세요.
- **저장 모양:** 저장소 열쇠 하나(예: `notebook`)에 판 번호(`v: 1`)와 함께 넣습니다. 나중에 모양이 바뀌어도 옛 값을 읽을 수 있게 합니다. 모르는 모양이면 빈 수첩으로 시작합니다(멈추지 않음).

## 끝났다고 보는 조건
1. 테스트를 먼저 쓰고, 구현 전에 **실패하는 것을 확인**합니다(PR 설명에 실패했던 테스트 수를 적기).
2. 위 규칙마다 테스트가 있습니다. 가짜 저장소는 `tests/unit/safeStorage.test.ts`의 `memoryStorage`·`throwing`처럼 만듭니다. 날짜는 `now`로 정합니다(12월 31일 23시 59분 → 1월 1일 0시 1분, 한국 시간).
3. `npm run check`와 `npm run e2e`가 통과합니다.
4. PR 설명은 쉬운 한국어로 ① 무엇을 왜 ② 해당 완성 기준(F4-AC…, F2-AC2c) ③ 사용자가 확인할 곳(이번에는 화면이 없으니 "테스트 이름 목록")을 적습니다.
5. AGENTS.md의 'Codex가 맡고 있는 것' 칸을 일 2로 바꿉니다(자기 칸만).

## 건드리지 않을 것
- 화면: `src/app.ts`, `src/ui/`, `src/main.ts`, `src/styles/`, `index.html`, `_review/`, `src/review/`, `tests/e2e/`, `tests/dom/`
- 데이터와 규칙: `content/`, `pipeline/`, `public/data/`, `shared/schema/`
- `package.json`, `package-lock.json` (새 도구가 필요하면 사용자에게 먼저 묻기)
- `CLAUDE.md`, 그리고 AGENTS.md의 'Claude가 맡고 있는 것' 칸
