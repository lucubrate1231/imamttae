#!/usr/bin/env bash
# dist/ 를 gh-pages 브랜치에 올립니다.
#   TARGET=next  → /next/ (미리보기, main 에 올릴 때마다)
#   TARGET=root  → / (베타 실제 주소 — D45로 알파와 비공개 베타를 합침, 버전 태그 v* 를 붙일 때만)
# 다른 쪽은 건드리지 않으므로 미리보기와 실제 주소가 따로 유지됩니다.
set -euo pipefail
: "${TARGET:?TARGET=next|root}" "${GITHUB_TOKEN:?}" "${GITHUB_REPOSITORY:?}"
REMOTE="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
git config --global user.name "github-actions[bot]"
git config --global user.email "41898282+github-actions[bot]@users.noreply.github.com"
rm -rf site
if git ls-remote --exit-code --heads "$REMOTE" gh-pages >/dev/null 2>&1; then
  git clone --quiet --depth 1 --branch gh-pages "$REMOTE" site
else
  mkdir site && git -C site init --quiet -b gh-pages && git -C site remote add origin "$REMOTE"
fi
if [ "$TARGET" = next ]; then
  rm -rf site/next && mkdir -p site/next && cp -r dist/. site/next/
  # 카톡 미리보기 그림 주소(og:image)는 베타 주소로 적혀 있어, 미리보기에서는 /next/ 쪽 그림을 가리키게 바꿈(D58)
  sed -i 's#github.io/imamttae/brand/#github.io/imamttae/next/brand/#g' site/next/index.html
  if [ ! -f site/index.html ]; then
    cat > site/index.html <<'HTML'
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>이맘때 풍경</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf9f4;color:#1f2a24;font:18px/1.7 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;word-break:keep-all;padding:24px;text-align:center}h1{color:#2f5d46;font-size:26px;margin:0 0 8px}</style></head>
<body><main><h1>이맘때 풍경</h1><p>곧 문을 열어요. 조금만 기다려 주세요.</p></main></body></html>
HTML
  fi
elif [ "$TARGET" = root ]; then
  find site -mindepth 1 -maxdepth 1 ! -name next ! -name .git -exec rm -rf {} +
  cp -r dist/. site/
  # 베타(루트)에는 작가 확인 페이지·법규 메모·내부 메모(_review)를 올리지 않음(공개 전 점검 6번, docs/public-repo-check.md)
  rm -rf site/_review
else
  echo "TARGET must be next or root" >&2; exit 1
fi
touch site/.nojekyll
cd site
git add -A
if git diff --cached --quiet; then echo "바뀐 것 없음"; exit 0; fi
git commit --quiet -m "deploy ${TARGET}: ${GITHUB_SHA:0:7}"
git push --quiet origin gh-pages
echo "✓ ${TARGET} 배포 완료"
