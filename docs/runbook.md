# 운영 안내 (runbook)

## 주소
- **저장소:** https://github.com/lucubrate1231/imamttae (공개)
- **미리보기:** https://imamttae.site/next/. main에 올릴 때마다 자동으로 바뀝니다. 개발 중 확인용입니다.
- **베타 주소(예전 이름 알파 주소, D45):** https://imamttae.site/ (D64, 10/8 — 옛 https://lucubrate1231.github.io/imamttae/… 는 GitHub이 새 주소로 넘겨 줌). 버전 태그(v0.1.0 등)를 붙였을 때만 바뀝니다. 지인에게 주는 주소입니다.

## 자주 하는 일
| 하고 싶은 일 | 방법 |
|---|---|
| 새 버전을 베타 주소에 내기 | 미리보기에서 확인 → 사용자 OK → `git tag v0.1.1 && git push origin v0.1.1` |
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
  - `https://imamttae.site`(D64)
  - `https://lucubrate1231.github.io`(옛 주소 — 새 주소로 넘어가는 것이 확인될 때까지 둠)

## 코드를 GitHub에 올리는 길 (Cowork 작업 공간)
Claude의 클라우드 작업 공간은 GitHub에 바로 올릴 수 없어서, 사용자 컴퓨터를 거쳐 올립니다.
중계는 사용자 컴퓨터 작업 공간(Cowork가 쓰는 리눅스 공간)의 git 저장소(`~/imamttae`)와 `~/bin/imamttae-sync.sh`가 맡습니다.
- 스크립트 원본은 저장소의 `scripts/relay/imamttae-sync.sh`입니다.
- GitHub 로그인은 이 공간에 저장되어 있습니다(gh CLI).

**순서 (`AGENTS.md` 규칙)**

> **10/7 저장소를 새로 만들었어요(깨끗한 기록).** 새 스크립트는 `pull` 때 옛 사본을 알아서 새 main으로 맞추고, 10/7 전 옛 기록 위에 만든 꾸러미·가지는 올리지 않아요(옛 카카오 좌표가 다시 공개되지 않게). 옛 스크립트가 "refusing to merge unrelated histories"로 멈추면 한 번만: `rm -rf ~/imamttae && git clone https://github.com/lucubrate1231/imamttae.git ~/imamttae && cp ~/imamttae/scripts/relay/imamttae-sync.sh ~/bin/ && chmod +x ~/bin/imamttae-sync.sh` (올릴 때 로그인을 물으면 `~/bin/gh auth setup-git`)
1. **작업 전에 최신본 받기:** `imamttae-sync.sh pull`
   - GitHub main을 꾸러미로 만들어 `band-to-brunch/imamttae-app/.sync/outgoing.bundle`에 둡니다.
   - Claude는 그 꾸러미를 받아 그 위에서 작업합니다.
2. **작업은 `claude/<주제>` 가지에서** 하고, 검사(`npm run check`, `npm run e2e`)를 통과시킵니다.
3. **꾸러미로 내려놓기:** 가지를 꾸러미로 만들어 `.sync/incoming.bundle`에 둡니다. PR 설명은 `.sync/pr-body.md`에 둡니다.
4. **PR 만들기:** `imamttae-sync.sh pr claude/<주제> "제목"`
   - 가지를 GitHub에 올리고 PR을 만듭니다.
   - 사용자가 GitHub에서 PR을 보고 **Merge**를 누르면 main에 들어가고 `/next/`에 배포됩니다.
5. 사용자가 허락한 작은 변경만 `imamttae-sync.sh push`로 main에 바로 올립니다.

- `band-to-brunch/imamttae-app/`에는 중계 파일(`.sync/`)만 둡니다. 예전에 두던 코드 사본은 10/3에 정리했습니다. 이제 코드는 GitHub과 사용자 컴퓨터의 클론에서 봅니다(Claude Code `C:\dev\imamttae-claude`).
  - 연결된 폴더에서는 파일을 지울 수 없어서, git이 자기 임시 파일을 지우지 못합니다. 그래서 git 저장소 자체는 그 폴더에 두지 않고 리눅스 공간의 `~/imamttae`에 둡니다.
- 지금 이 중계는 **Cowork의 Claude**만 씁니다(콘텐츠·데이터 PR). Claude Code는 클론에서 GitHub에 바로 올립니다.
- 새 Cowork 세션에서는 그 리눅스 공간이 비어 있을 수 있습니다. 그때는 다음 순서로 다시 준비합니다.
  1. GitHub에서 저장소를 새로 받습니다(clone).
  2. 기기 로그인 코드를 다시 받습니다.
- Claude Code나 GitHub Desktop으로 직접 작업하려면 GitHub에서 저장소를 새로 받는(clone) 것이 가장 깔끔합니다.

## 문제가 생겼을 때
- **지도가 안 뜨고 목록만 나옴:** 카카오 콘솔에 주소가 등록되어 있는지, `KAKAO_JS_KEY` 변수가 있는지, 카카오맵 사용 설정이 ON인지 확인합니다.
- **Actions가 빨간색:** Actions에서 실패한 단계를 엽니다. 휴대폰 화면 테스트가 실패했으면 `playwright-report` 파일을 내려받아 확인합니다.

## 앱 주소 `imamttae.site` 연결 (D64, 10/8)
GitHub Pages에 우리 주소를 붙여요. 베타 `https://imamttae.site/`, 미리보기 `https://imamttae.site/next/`. 앱은 상대 경로로 만들어서 빌드는 그대로이고, 배포할 때마다 사이트 주소 파일(`CNAME`)을 다시 써요(`scripts/publish-pages.sh`).

**1) Spaceship DNS 레코드**(Spaceship → Domain Manager → `imamttae.site` → **Nameservers & DNS** → **DNS records**). 처음 들어 있는 주차(parking)용 `@`·`www` 레코드가 있으면 지워요.
| 종류 | 이름(Host) | 값 | TTL |
|---|---|---|---|
| A | `@` | `185.199.108.153` | 기본값 |
| A | `@` | `185.199.109.153` | 기본값 |
| A | `@` | `185.199.110.153` | 기본값 |
| A | `@` | `185.199.111.153` | 기본값 |
| AAAA | `@` | `2606:50c0:8000::153` | 기본값 |
| AAAA | `@` | `2606:50c0:8001::153` | 기본값 |
| AAAA | `@` | `2606:50c0:8002::153` | 기본값 |
| AAAA | `@` | `2606:50c0:8003::153` | 기본값 |
| CNAME | `www` | `lucubrate1231.github.io` | 기본값 |

**2) (권장) GitHub 도메인 확인** — 다른 사람이 이 주소를 자기 GitHub 사이트에 붙이지 못하게 막아요. GitHub 오른쪽 위 내 사진 → **Settings** → 왼쪽 **Pages** → **Add a domain** → `imamttae.site` → GitHub이 보여 주는 TXT 값을 Spaceship에 넣고 → **Verify**.
| 종류 | 이름(Host) | 값 |
|---|---|---|
| TXT | `_github-pages-challenge-lucubrate1231` | GitHub 화면에 나온 값(사람마다 다름) |

**3) 순서**
1. 프프: 위 DNS 값 넣기(+ 도메인 확인) · 카카오 개발자 콘솔 [앱] → [플랫폼 키] → JavaScript 키의 **JavaScript SDK 도메인**에 `https://imamttae.site` 더하기(옛 `https://lucubrate1231.github.io`는 지우지 않음)
2. Claude Code: DNS가 퍼진 것 확인 → PR 합치기 → 저장소 Settings → Pages → Custom domain `imamttae.site`(배포가 `CNAME`을 써서 같이 붙음) → 보안 인증서가 붙으면 **Enforce HTTPS** 켜기
3. 확인: 새 주소·미리보기·공유 페이지·지도가 열리고, 옛 주소 `lucubrate1231.github.io/imamttae/…`(`/next/` 포함)가 새 주소로 넘어가는지
4. 프프: 새 주소에서 `?me=off`를 브라우저마다 다시(주소마다 따로 저장) · 카카오 공유 디버거에서 새 주소 캐시 · 기획: 초대 글 주소 바꾸기
