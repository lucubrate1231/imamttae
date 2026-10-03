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
git fetch -q origin
git checkout -q main
git merge -q --ff-only origin/main

fetch_in() {
  git bundle verify -q "$IN"
  git fetch -q -f "$IN" 'refs/heads/*:refs/remotes/incoming/*'
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
    git merge -q --ff-only incoming/main
    git push -q origin main --follow-tags
    ;;
  *)
    echo "사용법: $0 pull | pr <가지> [제목] | push" >&2
    exit 1
    ;;
esac

echo "HEAD $(git log -1 --format='%h %s' | cut -c1-60)"
