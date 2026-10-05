# Codex 일 5 — 첫 화면 속도 재는 도구 (지도 늦게 뜸 이슈)

> 맡은 사람: Codex · 가지: `codex/measure-speed` · 정한 날: 2026-10-05(개발 리드 Claude Code)
> **왜:** 기획 세션이 Pixel 7 + Playwright로 재 보니 첫 화면 사진 카드가 1.8~3.0초, 확대된 지도는 7.6~9.3초에 떴습니다. Claude Code가 화면 코드를 고치는 동안(`claude/map-speed`), **고치기 전과 뒤를 같은 방법으로 잴 도구**를 Codex가 만듭니다. 사람이 손으로 재면 매번 값이 달라지기 때문입니다.
> 화면 코드는 고치지 않습니다(`src/`, `index.html`, `tests/e2e/`는 Claude 칸).

## 고칠 파일 (이 파일들만)
- 새로 만듦: `scripts/measure-speed.mjs`, `docs/speed.md`(재는 법과 결과 표)
- `package.json`은 고치지 않습니다. 이미 있는 `@playwright/test`(chromium)만 씁니다. 실행은 `node scripts/measure-speed.mjs`.

## 만들 것

```
node scripts/measure-speed.mjs [주소] [--runs 5] [--case all|normal|slow4g|kakao-slow|kakao-blocked]
```
- 주소 기본값: `https://lucubrate1231.github.io/imamttae/next/`
- 휴대폰: `devices['Pixel 7']`(390×844), 매번 **새 브라우저 문맥**(캐시·서비스 워커 없음 = 처음 온 사람).
- `?map=fake`를 붙이지 않습니다(진짜 카카오 지도로 잼).

### 경우 4가지
| 이름 | 방법 |
|---|---|
| `normal` | 그대로 |
| `slow4g` | CDP `Network.emulateNetworkConditions` — 내려받기 1.6Mbps, 올리기 750kbps, 지연 150ms |
| `kakao-slow` | `dapi.kakao.com`(SDK)에 가는 요청만 5초 늦게 보냄(`page.route`) |
| `kakao-blocked` | `dapi.kakao.com`, `*.daumcdn.net` 요청을 모두 막음(`route.abort()`) |

### 잴 것 (페이지를 연 때부터 ms)
| 이름 | 언제 |
|---|---|
| `data` | `data/scenes.json` 응답이 다 온 때 |
| `cards` | 첫 사진 카드 그림이 보인 때: `.rail .big .photo img`가 `complete && naturalWidth > 0` |
| `mapTiles` | 첫 화면 지도(`.mapsec .kmap`) 안에 지도 그림 조각(`img`, 주소에 `daumcdn.net`)이 하나 이상 다 내려온 때 |
| `pins` | `.mapsec .kmap .pin`이 하나 이상 보인 때 |
| `sdk` | `dapi.kakao.com` 첫 요청이 끝난 때(참고용) |

- 정해진 시간(15초) 안에 안 되면 그 칸은 `—`로 적고 멈추지 않습니다(`kakao-blocked`에서 `mapTiles`·`pins`는 `—`가 맞음).
- 잴 때 `performance.now()`를 쓰려면 `page.waitForFunction`으로 조건이 참이 된 순간의 값을 페이지 안에서 기록해 돌려받습니다(밖에서 재면 Playwright 왕복 시간이 섞임).

### 출력
- 경우마다 `--runs`번 재서 **가운데 값(중앙값)**과 가장 느린 값을 마크다운 표로 찍습니다. 이슈에 그대로 붙일 수 있게.
```
| 경우 | 데이터 | 사진 카드 | 지도 조각 | 핀 |
|---|---|---|---|---|
| normal | 1.3초 (1.5) | 1.6초 (1.9) | 2.4초 (3.0) | 2.5초 (3.1) |
```
- `docs/speed.md`에 재는 법, 4가지 경우, **고치기 전(main 5f6322d) 결과 표**를 적어 둡니다.

## 완성 기준
- `node scripts/measure-speed.mjs --runs 3`이 4가지 경우 모두 끝까지 돌고 표를 찍는다(카카오가 막혀도 멈추지 않음).
- `kakao-blocked`에서 `cards`가 숫자로 나온다(지금 화면도 실패 지도로 바뀐 뒤 카드가 나오므로 숫자가 나와야 정상 — 다만 느림).
- `npm run check` 통과(새 스크립트가 예산·비밀 키 검사에 걸리지 않음).

## 끝나면
- PR 설명에 고치기 전 결과 표를 붙입니다. Claude Code가 `claude/map-speed`가 /next/에 올라간 뒤 이 도구로 다시 재서 이슈에 적습니다.
