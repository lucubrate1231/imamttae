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
중계는 사용자 컴퓨터 작업 공간(Cowork가 쓰는 리눅스 공간)의 git 저장소(`~/imamttae`)와 `~/bin/imamttae-sync.sh`가 맡습니다.
- 스크립트 원본은 저장소의 `scripts/relay/imamttae-sync.sh`입니다.
- GitHub 로그인은 이 공간에 저장되어 있습니다(gh CLI).

**Codex와 함께 일하는 지금의 순서 (10/3부터, `AGENTS.md` 규칙)**
1. **작업 전에 최신본 받기:** `imamttae-sync.sh pull`
   - GitHub main(Codex가 합친 것 포함)을 꾸러미로 만들어 `band-to-brunch/imamttae-app/.sync/outgoing.bundle`에 둡니다.
   - Claude는 그 꾸러미를 받아 그 위에서 작업합니다.
2. **작업은 `claude/<주제>` 가지에서** 하고, 검사(`npm run check`, `npm run e2e`)를 통과시킵니다.
3. **꾸러미로 내려놓기:** 가지를 꾸러미로 만들어 `.sync/incoming.bundle`에 둡니다. PR 설명은 `.sync/pr-body.md`에 둡니다.
4. **PR 만들기:** `imamttae-sync.sh pr claude/<주제> "제목"`
   - 가지를 GitHub에 올리고 PR을 만듭니다.
   - 사용자가 GitHub에서 PR을 보고 **Merge**를 누르면 main에 들어가고 `/next/`에 배포됩니다.
5. 사용자가 허락한 작은 변경만 `imamttae-sync.sh push`로 main에 바로 올립니다.

- `band-to-brunch/imamttae-app/`에는 중계 파일(`.sync/`)만 둡니다. 예전에 두던 코드 사본은 10/3에 정리했습니다. 이제 코드는 GitHub과 사용자 컴퓨터의 클론에서 봅니다(Codex `C:\dev\imamttae`, Claude Code `C:\dev\imamttae-claude`).
  - 연결된 폴더에서는 파일을 지울 수 없어서, git이 자기 임시 파일을 지우지 못합니다. 그래서 git 저장소 자체는 그 폴더에 두지 않고 리눅스 공간의 `~/imamttae`에 둡니다.
- 지금 이 중계는 **Cowork의 Claude**만 씁니다(콘텐츠·데이터 PR). Claude Code와 Codex는 클론에서 GitHub에 바로 올립니다.
- 새 Cowork 세션에서는 그 리눅스 공간이 비어 있을 수 있습니다. 그때는 다음 순서로 다시 준비합니다.
  1. GitHub에서 저장소를 새로 받습니다(clone).
  2. 기기 로그인 코드를 다시 받습니다.
- Claude Code나 GitHub Desktop으로 직접 작업하려면 GitHub에서 저장소를 새로 받는(clone) 것이 가장 깔끔합니다.

## 문제가 생겼을 때
- **지도가 안 뜨고 목록만 나옴:** 카카오 콘솔에 주소가 등록되어 있는지, `KAKAO_JS_KEY` 변수가 있는지, 카카오맵 사용 설정이 ON인지 확인합니다.
- **Actions가 빨간색:** Actions에서 실패한 단계를 엽니다. 휴대폰 화면 테스트가 실패했으면 `playwright-report` 파일을 내려받아 확인합니다.
