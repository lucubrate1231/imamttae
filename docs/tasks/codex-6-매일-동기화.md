# Codex 일 6 — 매일 아침 브런치 자동 동기화 (개발계획 3장 4번, 알파부터 필요)

> 맡은 사람: Codex · 가지: `codex/daily-sync` · 정한 날: 2026-10-05(개발 리드 Claude Code)
> **시작 조건:** 일 5(첫 화면 속도 재는 도구) PR을 올린 뒤. 한 번에 하나만 합니다.
> **왜:** 작가가 브런치에 새 글을 올리면 다음 날 아침 앱 데이터의 글 목록(`content/brunch/index.json`)에 들어와야 콘텐츠 세션이 장면 초안을 만들 수 있습니다. 지금은 사람이 `npx tsx pipeline/sync.ts`를 돌립니다.
> **장면 정리는 하지 않습니다.** 장면 종류·한 줄 소개는 지금처럼 콘텐츠 세션이 초안 → 사용자 확인. 이 일은 '글 목록을 최신으로'까지만입니다.

## 고칠 파일 (이 파일들만)
- 새로 만듦: `.github/workflows/sync.yml`, `docs/sync.md`(어떻게 돌고 실패하면 무엇을 보나)
- 필요하면 새로 만듦: `pipeline/daily.ts`(바뀐 글 요약을 PR 설명으로 찍기 등), `tests/unit/daily.test.ts`
- `pipeline/sync.ts`·`pipeline/brunch/`는 고치지 않습니다(콘텐츠 세션 칸). 고쳐야 하면 PR 설명에 적어 물어 주기.
- `package.json`은 고치지 않습니다.

## 만들 것: `.github/workflows/sync.yml`
1. **언제:** 매일 한국 시간 아침 6시(`cron: '0 21 * * *'`, UTC) + 손으로 돌리기(`workflow_dispatch`).
2. **하는 일:** `npm ci` → `npx tsx pipeline/sync.ts` → 바뀐 것이 없으면 조용히 끝.
3. **검사를 통과할 때만 반영:** 바뀐 것이 있으면 `npx tsx pipeline/scenes/check-cli.ts content/scenes/drafts.json` → `npx tsx pipeline/scenes/build.ts` → `npm run check`가 **모두 통과할 때만** PR을 엽니다. 하나라도 실패하면 PR을 열지 않고 워크플로를 실패로 끝냅니다(GitHub이 사용자에게 메일로 알림).
4. **PR로 올림(main에 바로 올리지 않음):** 가지 `bot/brunch-sync`(있으면 덮어씀), 제목 `브런치 새 글 N편 (YYYY-MM-DD)`, 설명에 새 글·바뀐 글의 번호·제목·브런치 주소 목록. 합치는 것은 사용자입니다.
   - 주의: 워크플로가 기본 `GITHUB_TOKEN`으로 연 PR에는 다른 워크플로(ci.yml)가 돌지 않습니다. 그래서 3번 검사를 이 워크플로 안에서 먼저 돌립니다. PR 설명에 "검사는 동기화 워크플로에서 통과(링크)"를 남깁니다.
5. **올리지 않는 것:** `.cache/`(글 전문 — 작가 글 보호, 공모전 중복 게재 우려)는 절대 커밋하지 않습니다. 커밋하는 파일은 `content/brunch/index.json`과(바뀌었다면) `public/data/scenes.json`뿐.
6. **브런치에 부담 주지 않기:** `.cache/brunch`를 `actions/cache`로 이어 써서 바뀐 글만 다시 받게 합니다(sync.ts가 이미 바뀐 글만 받음).
7. **비밀 키:** 필요 없음(브런치 공개 글). 카카오 키 쓰지 않음. 브런치 로그인·발행 버튼 없음.

## 완성 기준
- `workflow_dispatch`로 한 번 돌려 (a) 바뀐 것 없음 → 조용히 끝, (b) 테스트용으로 `index.json`의 글 하나를 지운 가지에서 돌리면 → PR이 열리고 그 글이 다시 들어옴, 을 보여 주는 실행 링크를 PR 설명에 붙입니다.
- 검사 실패를 흉내 냈을 때 PR이 열리지 않음.
- `npm run check` 통과(새 워크플로·스크립트에 비밀 키 없음).

## 끝나면
- `docs/sync.md`에 '아침에 PR이 오면 사용자가 할 일'(콘텐츠 세션에 새 글 장면 초안 부탁 → 합치기)을 쉬운 말로 적습니다.
