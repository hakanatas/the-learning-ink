#!/usr/bin/env bash
# One-shot GitHub publish for The Learning Ink.
# Needs: git + GitHub CLI (https://cli.github.com) logged in with `gh auth login`.
#   ./publish.sh            → creates hakanatas/the-learning-ink (public), pushes, turns on Pages
#   Put the .mp4 files next to this script first if you want them attached to a v1.0 release.
set -euo pipefail
REPO="${REPO:-hakanatas/the-learning-ink}"
cd "$(dirname "$0")"

[ -d .git ] || { git init -q -b main; git add -A; git commit -qm "The Learning Ink: procedural ink film about how neural networks learn"; }

if ! gh repo view "$REPO" >/dev/null 2>&1; then
  gh repo create "$REPO" --public --source=. --remote=origin \
    --description "Öğrenen Mürekkep: a 90-second procedural ink film (Canvas 2D) explaining how a neural network learns. TR/EN captions, MP4 export." \
    --homepage "https://${REPO%%/*}.github.io/${REPO##*/}/" --push
else
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$REPO.git"
  git push -u origin main
fi

# GitHub Pages, built by .github/workflows/pages.yml
gh api -X POST "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 \
  || gh api -X PUT "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 || true
gh workflow run pages.yml -R "$REPO" >/dev/null 2>&1 || true
gh repo edit "$REPO" --add-topic neural-network,machine-learning,education,canvas,generative-art,animation,turkish >/dev/null 2>&1 || true

# Optional: attach the films to a release
shopt -s nullglob
VIDEOS=( *.mp4 *.srt )
if [ ${#VIDEOS[@]} -gt 0 ] && ! gh release view v1.0 -R "$REPO" >/dev/null 2>&1; then
  gh release create v1.0 "${VIDEOS[@]}" -R "$REPO" --title "The Learning Ink v1.0" \
    --notes "90-second film in 16:9 (TR+EN captions) and 9:16 (TR captions), with matching .srt subtitle files."
fi

echo
echo "✓ Code:   https://github.com/$REPO"
echo "✓ Player: https://${REPO%%/*}.github.io/${REPO##*/}/  (live after the Pages action finishes, ~1 min)"
