#!/usr/bin/env bash
# Claude 클라우드 작업 공간 ↔ GitHub 중계 스크립트. 사용자 컴퓨터의 Cowork 작업 공간에서 실행합니다.
# 설치: cp scripts/relay/imamttae-sync.sh ~/bin/ && chmod +x ~/bin/imamttae-sync.sh
#
#   pull              GitHub 최신 main을 받아 .sync/outgoing.bundle 로 내보냄 (Claude가 작업 전에 받아 감)
#   pr <가지> [제목]   Claude가 만든 .sync/incoming.bundle 의 가지를 GitHub에 올리고 PR을 만듦
#                     (.sync/pr-body.md 가 있으면 PR 설명으로 씀. 같은 가지 PR이 이미 있으면 가지만 갱신)
#   push              incoming 의 main을 GitHub main에 바로 올림 — 사용자가 허락한 경우만
#
# 사용자 폴더의 band-to-brunch/imamttae-app 에는 중계 파일(.sync/)만 둡니다.
# 코드 사본은 두지 않습니다(10/3 정리 — 코드는 GitHub과 C:\dev 의 클론에서 봅니다).
set -euo pipefail
APP="$HOME/mnt/band-to-brunch/imamttae-app"
IN="$APP/.sync/incoming.bundle"
OUT="$APP/.sync/outgoing.bundle"
BODY="$APP/.sync/pr-body.md"
GH="$HOME/bin/gh"

cd "$HOME/imamttae"
git fetch -q --prune origin
# 10/7 저장소를 새로 만들어(깨끗한 기록) 옛 사본과 기록이 이어지지 않으면, 옛 가지·꾸러미 기록을 지우고 새 main으로 맞춤
# (중계 사본에는 여기서만 있는 작업이 없음 — 작업은 꾸러미로 오고 GitHub에 올라감)
if ! git merge-base main origin/main >/dev/null 2>&1; then
  echo "GitHub 저장소가 새로 만들어져 중계 사본을 새 main으로 맞춥니다(옛 기록은 지움)"
  git checkout -q -f -B main origin/main
  git for-each-ref --format='%(refname)' refs/heads refs/remotes/incoming | { grep -vx refs/heads/main || true; } | xargs -r -n1 git update-ref -d
  git reflog expire --expire=now --all && git gc -q --prune=now
fi
git checkout -q main
git merge -q --ff-only origin/main

fetch_in() {
  git bundle verify -q "$IN" || { echo "꾸러미가 지금 main과 이어지지 않아요. 10/7 전(옛 기록)에 만든 꾸러미면 새 outgoing.bundle 위에서 다시 만들어 주세요" >&2; exit 1; }
  git fetch -q -f "$IN" 'refs/heads/*:refs/remotes/incoming/*'
}

# 옛 기록 위에 만든 가지는 올리지 않음(옛 카카오 좌표·메모가 다시 공개됨 — docs/kakao-local-data.md 4장 5번)
same_history() {
  git merge-base origin/main "$1" >/dev/null 2>&1 || { echo "$1 은(는) 지금 GitHub main과 기록이 이어지지 않아 올리지 않아요(10/7 전 옛 기록). 새 outgoing.bundle 위에서 다시 만들어 주세요" >&2; exit 1; }
}

case "${1:-}" in
  pull)
    git bundle create -q "$OUT" main
    echo "OUT $(git log -1 --format='%h %s' | cut -c1-60)"
    ;;
  pr)
    BR="${2:?가지 이름이 필요합니다 (예: claude/scene-detail)}"
    TITLE="${3:-$BR}"
    fetch_in
    same_history "refs/remotes/incoming/$BR"
    git push -q -f origin "refs/remotes/incoming/$BR:refs/heads/$BR"
    if "$GH" pr view "$BR" --json url -q .url 2>/dev/null; then
      echo "같은 가지의 PR이 이미 있어 가지만 갱신했습니다"
    elif [ -f "$BODY" ]; then
      "$GH" pr create --head "$BR" --base main --title "$TITLE" --body-file "$BODY"
    else
      "$GH" pr create --head "$BR" --base main --title "$TITLE" --body "Claude 작업 — 설명은 커밋 메시지를 보세요."
    fi
    ;;
  push)
    fetch_in
    same_history incoming/main
    git merge -q --ff-only incoming/main
    git push -q origin main --follow-tags
    ;;
  *)
    echo "사용법: $0 pull | pr <가지> [제목] | push" >&2
    exit 1
    ;;
esac

echo "HEAD $(git log -1 --format='%h %s' | cut -c1-60)"
