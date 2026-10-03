# Codex 일 2 — 가고 싶어요 저장 (F2-AC2c)

> 맡은 사람: Codex · 가지: `codex/wanted` · 정한 날: 2026-10-03(사용자 결정)
> **범위를 줄였습니다(10/3 사용자 결정):** 내 수첩(F4)의 계획과 디자인이 아직 끝나지 않았습니다. 그래서 확정 시안 v2에 이미 있는 **'가고 싶어요' 저장만** 합니다.
> 도장, 다녀온 곳, 새해 넘김은 내 수첩 계획·디자인이 정해진 뒤 따로 맡깁니다.
> 일 1(PR #13)과 고치는 파일이 겹치지 않으니, main에서 새 가지를 만들어 바로 시작해도 됩니다.

## 왜 지금 하나
장면 상세 아래 막대의 '가고 싶어요'는 확정 시안 v2에 있고, Claude가 지금 장면 상세를 실제 앱으로 옮기고 있습니다.
Claude는 아래 함수 이름으로 화면을 미리 연결해 두고, 그전까지는 화면을 닫으면 사라지는 임시 저장을 씁니다.
이 일이 합쳐지면 화면은 손대지 않고 휴대폰에 남는 저장으로 바뀝니다.

## 고칠 파일 (이 파일들만)
- 새로 만듦: `src/storage/wanted.ts`, `tests/unit/wanted.test.ts`
- `src/storage/safeStorage.ts`는 그대로 가져다 씁니다. 꼭 고쳐야 하면 PR 설명에 적어 묻기.

## 만들 것 (함수 이름과 주고받는 값은 이대로. 바꿔야 하면 PR 설명에 적어 사용자에게 묻기)

```ts
// src/storage/wanted.ts
import { createSafeStore, type SafeStore } from './safeStorage';

export interface WantedStore {
  /** 이 브라우저에 저장이 되는가. false여도 아래 함수는 모두 작동(화면을 닫으면 사라질 뿐) */
  readonly saved: boolean;
  /** 그 장면을 담았는가 */
  isWanted(sceneId: string): boolean;
  /** 담기·빼기를 바꾸고, 바뀐 뒤 상태를 돌려줌(true = 담음) */
  toggleWanted(sceneId: string): boolean;
  /** 담은 장면 id, 최근에 담은 것이 앞 */
  wanted(): string[];
}

/** store: 휴대폰 저장소(테스트에서는 가짜). 없으면 createSafeStore() */
export function createWantedStore(store?: SafeStore): WantedStore;
```

## 규칙
- **남아 있기:** 새로 만든 `createWantedStore`(새로고침 흉내)도 앞에서 담은 것을 그대로 읽습니다.
- **저장이 막혀도:** 사생활 보호 모드, 저장 공간 부족, 깨진 값이 있어도 예외를 던지지 않습니다. 이때 `saved`는 false이고 함수는 메모리에서 그대로 작동합니다.
  - `createSafeStore`는 실제로 써 보기 전까지 `available`이 true일 수 있습니다. 처음 만들 때 한 번 써 보는 등으로 `saved`를 정확히 정합니다.
- **같은 장면 두 번 담기 없음:** 담긴 장면을 다시 담는 일은 없습니다(토글). 목록에 같은 id가 두 번 나오지 않습니다.
- **저장 모양:** 저장소 열쇠 하나(`wanted`)에 판 번호와 함께 넣습니다(예: `{ v: 1, ids: [...] }`). 나중에 내 수첩이 이 목록을 그대로 읽을 수 있게 합니다. 모르는 모양이면 빈 목록으로 시작합니다(멈추지 않음).
- **없는 장면 id:** 데이터에서 빠진 장면 id가 남아 있어도 그대로 둡니다. 화면에서 거릅니다.

## 끝났다고 보는 조건
1. 테스트를 먼저 쓰고, 구현 전에 **실패하는 것을 확인**합니다(PR 설명에 실패했던 테스트 수를 적기).
2. 위 규칙마다 테스트가 있습니다. 가짜 저장소는 `tests/unit/safeStorage.test.ts`의 `memoryStorage`·`throwing`처럼 만듭니다.
3. `npm run check`와 `npm run e2e`가 통과합니다.
4. PR 설명은 쉬운 한국어로 ① 무엇을 왜 ② 해당 완성 기준(F2-AC2c) ③ 사용자가 확인할 곳(이번에는 화면이 없으니 "테스트 이름 목록")을 적습니다.
5. AGENTS.md의 'Codex가 맡고 있는 것' 칸을 일 2로 바꿉니다(자기 칸만).

## 건드리지 않을 것
- 화면: `src/app.ts`, `src/ui/`, `src/main.ts`, `src/styles/`, `index.html`, `_review/`, `src/review/`, `tests/e2e/`, `tests/dom/`
- 데이터와 규칙: `content/`, `pipeline/`, `public/data/`, `shared/schema/`
- `package.json`, `package-lock.json` (새 도구가 필요하면 사용자에게 먼저 묻기)
- `CLAUDE.md`, 그리고 AGENTS.md의 'Claude가 맡고 있는 것' 칸
