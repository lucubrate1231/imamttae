# 사용 통계 설계 (Umami) — 설계안 v1

> 개발 리드 Claude Code · 2026-10-04 · **사용자 확인 전 설계안**(CLAUDE.md: 설계안을 먼저 보여 주고 붙임)
> 기준: 기획 통계 문서 `claude/자연여행앱-통계도구-비교.md` **7장 '측정 계획 v1'**(사건 13개·붙이는 규칙). 도구는 Umami Cloud 무료(10/4 결정).
> 사건 이름은 7장 그대로 씁니다. 단 `want`는 **`save`**로 바꿨습니다(10/4 기획 결정 D28: 버튼이 [저장]/[저장됨]). 더 바꾸게 되면 기획에 알려 7장을 맞춥니다.

## 1. 실제로 확인한 것 (Umami 추적 스크립트를 내려받아 읽음, 10/4)
- **Umami 기본 설정은 이 앱의 화면 이동을 세지 못합니다.** Umami는 주소가 `pushState`·`replaceState`로 바뀔 때만 화면 조회를 셉니다. 이 앱은 `#` 뒤만 바꿔(`#/scene/…`, `#/find/…`) 화면을 옮기므로, **처음 연 화면 한 번만** 세고 그 뒤 이동과 휴대폰 뒤로 가기는 세지 않습니다.
  - 그래서 **앱이 화면을 옮길 때마다 직접 화면 조회를 보냅니다**(자동 조회는 끔, 아래 3장). 주소의 `#` 뒤까지 그대로 보냅니다(`exclude-hash` 끔 — 기본값).
- `data-domains`: 지금 주소의 호스트가 목록에 없으면 아무것도 보내지 않습니다 → `lucubrate1231.github.io`만 적으면 내 컴퓨터(localhost)와 화면 테스트(CI)는 저절로 빠집니다.
- `umami.disabled`: 브라우저 저장소에 이 값이 있으면 아무것도 보내지 않습니다 → '우리 식구 빼기'(`?me=off`)에 그대로 씁니다.

## 2. 사건 → 앱의 어디에 다나
지금 있는 화면(지금 풍경·장면 상세·풍경 찾기)에 다는 것만 '지금'으로 표시했습니다.

| 사건 | 다는 곳 | 함께 보내는 값 | 언제 |
|---|---|---|---|
| `app-open` | 앱이 처음 그려진 뒤 한 번 | `mode`(home-screen / kakao-inapp / browser), `from`(주소에 `?from=share`일 때만 share), `first_month`('YYYY-MM' 또는 none), `returning`(true/false) | 지금 |
| `scene-open` | 장면 상세가 열릴 때 | `scene`(장면 id, 예 `s-005-biryong`), `from`: photo-card(첫 화면 큰 카드·준비 중 카드) / map-pin(지도 점) / visited-row(첫 화면 '작가 부부가 다녀온 곳' 줄) / find-list(풍경 찾기 목록 줄) / link(주소로 바로) · saved / stamp / alert-card는 F4 때 | 지금 |
| `navi` ★ | 길찾기 버튼, '다른 앱으로 길찾기'에서 고른 앱, 티맵이 안 열렸을 때 고른 다른 앱 | `app`(tmap / naver / kakao), `how`(main / other), `scene`, `where`(detail, F4 때 saved) | 지금 |
| `navi-no-app` | 티맵이 안 열렸을 때 '티맵 설치'를 누름 | `app` | 지금 |
| `share` | 공유 버튼 | `scene`, `where`(detail, F4 때 stamp), `how`(share-sheet / copy) | 지금 |
| `save` | [저장]을 누르거나 다시 눌러 뺄 때(옛 '가고 싶어요', D28) | `scene`, `on`(true / false) | 지금 |
| `brunch` | '브런치에서 전체 이야기 읽기' | `scene` | 지금 |
| `news` | '올해 ○○ 찾아보기' | `scene` | 지금 |
| `error` | 지도를 못 불러옴 / 장면 데이터를 못 불러옴 / 저장이 막힘 | `kind`(map-fail / data-fail / storage-blocked) | 지금 |
| `feedback` | 의견 보내기 버튼 | — | **버튼이 아직 없음 → 정할 것 ①** |
| `alert-card` | 제철 알림 카드 | `action`, `where`, `count` | F4 화면과 함께 |
| `visited` | 다녀왔어요·취소·날짜 고치기 | `scene`, `action` | F4 화면과 함께 |
| `a2hs` | 홈 화면에 두기 | `action`(tap / guide) | F5와 함께(지금 버튼은 '곧 열려요') |

- 버튼·문구 글자는 디자인 세션의 design-guide '화면 글자 표'를 따릅니다(D28~D30). 사건은 글자가 아니라 버튼에 달기 때문에 글자가 바뀌어도 사건 이름은 그대로입니다.
- **화면 조회:** 화면을 옮길 때마다 `#` 뒤까지 포함한 주소로 보냅니다. 예: `/imamttae/#/find/danpung/gangwon`, `/imamttae/#/scene/s-005-biryong`. 풍경·권역·장면 인기는 이 조회로 봅니다(따로 사건 없음).
- **퍼널(첫 화면 → 상세 → 길찾기):** `app-open` → `scene-open` → `navi`.

## 3. 붙이는 방법
- **한 곳에서만 보냄:** `src/analytics.ts`의 `track(사건, 값)`과 `pageview(주소)` 두 함수만 화면 코드가 부릅니다. 화면 코드는 Umami를 직접 모릅니다.
- **사이트 하나, 꼬리표 둘(10/4 사용자):** Umami 무료 계정은 사이트를 하나만 만들 수 있어서 알파와 미리보기가 웹사이트 ID 하나(`84ee01a2-…`, `src/analytics.ts`의 `SITE_ID`)를 같이 씁니다. ID는 비밀 키가 아니라 공개 번호라 코드에 적어 둡니다.
  - 주소가 `/imamttae/next/`로 시작하면 꼬리표 `data-tag="preview"`, 아니면 `data-tag="alpha"`를 붙입니다. 빌드를 둘로 나눌 필요가 없습니다.
  - **대시보드에서 거르기:** 필터에서 꼬리표(Tag)를 `alpha` 또는 `preview`로 고릅니다. 꼬리표 필터가 안 보이면 주소(URL) 필터로 `/imamttae/next/`가 들어간 것(미리보기)과 아닌 것(알파)을 나눕니다. 화면 조회 주소에 `/next/`가 그대로 들어가서 두 방법 모두 됩니다.
- **github.io에서만 보냄:** 지금 주소가 `lucubrate1231.github.io`가 아니면(내 컴퓨터·화면 테스트) 스크립트를 부르지도 않습니다. 스크립트의 `data-domains`도 같은 주소라 이중으로 막힙니다.
- **스크립트:** 첫 화면을 다 그린 뒤 `defer`로 부릅니다. 속성 — `data-website-id`, `data-domains="lucubrate1231.github.io"`, `data-auto-track="false"`(화면 이동은 앱이 직접 보냄), `data-tag`(preview/alpha). 스크립트가 오기 전에 생긴 사건(`app-open`, 첫 화면 조회)은 **최대 50개까지 줄 세워 두었다가** 스크립트가 오면 순서대로 보냅니다(구현하며 바꿈: 버리면 `app-open`이 늘 사라짐). 광고 차단기 등으로 못 불러오면 줄을 비우고 앱은 그대로입니다.
- **같은 주소를 연달아 두 번 세지 않습니다.**
- **우리 식구 빼기:** 주소에 `?me=off`가 있으면 이 브라우저 저장소에 `umami.disabled`를 넣고 "이 브라우저는 통계에서 빠졌어요" 한 줄을 띄웁니다. `?me=on`이면 지우고 "다시 통계에 들어가요". 그 뒤 주소에서 `me`는 지웁니다(다시 열거나 공유돼도 반복되지 않게). 브라우저마다 따로라 카카오톡 안 화면에서도 한 번 열어야 합니다.
- **처음 연 달(D27):** 휴대폰 저장소에 `first-month` 한 칸('YYYY-MM', 한국 날짜)만 둡니다. 처음이면 지금 달을 적고 `returning=false`, 있으면 그 값과 `returning=(그 달 < 이번 달)`. 저장이 막히면 `first_month=none`, `returning=false`, 그리고 `error`(storage-blocked).
- **공유 주소:** 공유할 때 주소를 새로 만듭니다 — `https://…/imamttae/?from=share#/scene/<id>`. 받은 사람에게 의미 없는 꼬리표(`utm_*`, `me`)는 빼고 `from=share`만 붙입니다. 앱 안 화면 이동은 `#` 뒤만 바꾸므로 `?from=share`·`utm_*`는 지워지지 않습니다.
- **열린 방식(`mode`):** 홈 화면 앱(`display-mode: standalone` 또는 아이폰 `navigator.standalone`) → home-screen, 카카오톡 안 브라우저(브라우저 이름표에 `KAKAOTALK`) → kakao-inapp, 그 밖 → browser.

## 4. 보내지 않는 것
이름·연락처·위치·좌표·적어 넣은 글·저장한 곳 목록 전체·개인을 가리키는 번호. `umami.identify`는 쓰지 않습니다. 장면 id·풍경·권역·달·앱 이름은 보냅니다.

## 5. 테스트 계획 (TDD)
- 단위: ID가 없거나 github.io가 아니면 아무것도 안 함 / 꼬리표 고르기(알파·미리보기) / `first_month`·`returning`(달 넘김, 저장 막힘) / `mode` 가리기 / 공유 주소 만들기(꼬리표 빼기) / `?me=off`·`on`
- 화면 조각: 가짜 추적기를 끼워 버튼마다 맞는 사건과 값이 나가는지(위 2장 표의 '지금' 줄 전부), 화면 이동마다 화면 조회 한 번
- 사용 흐름: 내 컴퓨터(localhost)에서는 Umami로 아무 요청도 나가지 않음 / Umami 스크립트를 막아도 앱이 그대로 작동
- 실제 확인(ID를 받은 뒤): `/next/`에서 몇 번 눌러 Umami 화면에 사건과 `#` 주소가 들어오는지

## 6. 정할 것
1. **`feedback`(의견 보내기) 버튼 자리:** 지금 화면에 의견 보내기 버튼이 없습니다. 어디에 둘지(예: 첫 화면 맨 아래 '이 앱 이야기' 옆), 누르면 무엇이 열리는지(카카오톡 오픈채팅·구글 폼·이메일)는 기획·디자인이 정해 주세요. 정해지면 버튼과 사건을 함께 답니다.
2. ~~웹사이트 ID~~ **받음(10/4):** 사이트 하나를 알파·미리보기가 같이 쓰고 꼬리표로 나눔(3장).
