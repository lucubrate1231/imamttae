# 운영 안내 (runbook)

## 주소
- **저장소:** https://github.com/lucubrate1231/imamttae (공개)
- **미리보기:** https://lucubrate1231.github.io/imamttae/next/. main에 올릴 때마다 자동으로 바뀝니다. 개발 중 확인용입니다.
- **알파 주소:** https://lucubrate1231.github.io/imamttae/. 버전 태그(v0.1.0 등)를 붙였을 때만 바뀝니다. 지인에게 주는 주소입니다.

## 자주 하는 일
| 하고 싶은 일 | 방법 |
|---|---|
| 새 버전을 알파 주소에 내기 | 미리보기에서 확인 → 사용자 OK → `git tag v0.1.1 && git push origin v0.1.1` |
| 문제가 생겨 이전 버전으로 되돌리기 | GitHub 저장소 → Actions → **redeploy** → Run workflow → 버전(예: v0.1.0)과 `root` 선택. 2~3분이면 끝납니다 |
| 사진 하나를 내리기 | `content/flags.json`의 숨김 목록에 넣고 올리기 (기능 단계에서 추가) |
| 실제 지도가 뜨는지 확인 | Actions → **live** → Run workflow (매일 새벽 3시 7분에도 자동 실행) |

## 키와 비밀 값
| 이름 | 어디에 | 누가 넣나 |
|---|---|---|
| `KAKAO_REST_KEY` | 저장소 Settings → Secrets and variables → Actions → **Secrets** | 사용자 |
| `KAKAO_JS_KEY` | 같은 곳의 **Variables** 탭 | 사용자 |

- 카카오 키는 카카오 개발자 콘솔 [앱] → [플랫폼 키]에서 확인합니다.
- JS 키는 등록한 도메인에서만 작동합니다. 카카오 콘솔의 JavaScript SDK 도메인에는 다음 두 개가 있어야 합니다.
  - `http://localhost:8080`
  - `https://lucubrate1231.github.io`

## 코드를 GitHub에 올리는 길 (Cowork 작업 공간)
Claude의 클라우드 작업 공간은 GitHub에 바로 올릴 수 없어서, 사용자 컴퓨터를 거쳐 올립니다.
1. 클라우드에서 개발·테스트한 뒤 바뀐 내용을 꾸러미 파일 하나(git bundle)로 만듭니다.
2. 그 파일을 사용자 폴더 `band-to-brunch/imamttae-app/.sync/incoming.bundle`에 내려놓습니다. 매번 같은 파일을 덮어씁니다.
3. 사용자 컴퓨터 작업 공간(Cowork가 쓰는 리눅스 공간)의 git 저장소(`~/imamttae`)가 꾸러미를 합친 뒤 GitHub에 올립니다.
   - 실행하는 것은 `~/bin/imamttae-sync.sh push`입니다.
   - GitHub 로그인은 이 공간에 저장되어 있습니다(gh CLI).
4. 마지막으로 `band-to-brunch/imamttae-app/` 폴더에 최신 파일을 펼쳐 둡니다.

- `imamttae-app/` 폴더는 GitHub 저장소와 같은 파일을 담은 **사본**입니다(.git 없음).
  - 연결된 폴더에서는 파일을 지울 수 없어서, git이 자기 임시 파일을 지우지 못합니다. 그래서 git 저장소 자체는 그 폴더에 두지 않습니다.
- 새 Cowork 세션에서는 그 리눅스 공간이 비어 있을 수 있습니다. 그때는 다음 순서로 다시 준비합니다.
  1. GitHub에서 저장소를 새로 받습니다(clone).
  2. 기기 로그인 코드를 다시 받습니다.
- Claude Code나 GitHub Desktop으로 직접 작업하려면 GitHub에서 저장소를 새로 받는(clone) 것이 가장 깔끔합니다.

## 문제가 생겼을 때
- **지도가 안 뜨고 목록만 나옴:** 카카오 콘솔에 주소가 등록되어 있는지, `KAKAO_JS_KEY` 변수가 있는지, 카카오맵 사용 설정이 ON인지 확인합니다.
- **Actions가 빨간색:** Actions에서 실패한 단계를 엽니다. 휴대폰 화면 테스트가 실패했으면 `playwright-report` 파일을 내려받아 확인합니다.
