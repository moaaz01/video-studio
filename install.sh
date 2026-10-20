#!/usr/bin/env bash
# video-studio - link the skill into every agent that reads SKILL.md.
#
#   ./install.sh              # dsh, claude, opencode, agents, hermes
#   ./install.sh dsh claude   # only these
#   ./install.sh --remove     # remove the links, keep the repo
set -euo pipefail

NAME="video-studio"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$HERE/SKILL.md" ]]; then
  echo "SKILL.md not found next to this script - run it from the repo root." >&2
  exit 1
fi

REMOVE=0
TARGETS=()
for arg in "$@"; do
  case "$arg" in
    --remove) REMOVE=1 ;;
    *) TARGETS+=("$arg") ;;
  esac
done
[[ ${#TARGETS[@]} -eq 0 ]] && TARGETS=(dsh claude opencode agents hermes)

target_dir() {
  case "$1" in
    dsh)      echo "$HOME/.dsh/skills" ;;
    claude)   echo "$HOME/.claude/skills" ;;
    opencode) echo "$HOME/.config/opencode/skills" ;;
    agents)   echo "$HOME/.agents/skills" ;;
    hermes)   echo "$HOME/.hermes/skills" ;;
    *)        echo "" ;;
  esac
}

for t in "${TARGETS[@]}"; do
  dir="$(target_dir "$t")"
  if [[ -z "$dir" ]]; then echo "skip: unknown target '$t'"; continue; fi
  link="$dir/$NAME"

  if [[ $REMOVE -eq 1 ]]; then
    if [[ -L "$link" ]]; then rm "$link"; echo "removed $link"; fi
    continue
  fi

  mkdir -p "$dir"
  if [[ -L "$link" ]]; then
    rm "$link"
  elif [[ -e "$link" ]]; then
    echo "skip: $link exists and is not a symlink (move it by hand)" >&2
    continue
  fi
  ln -s "$HERE" "$link"
  if [[ -f "$link/SKILL.md" ]]; then
    echo "OK   $t -> $link"
  else
    echo "ERR  $t -> $link" >&2
  fi
done

if [[ $REMOVE -eq 0 ]]; then
  echo
  echo "Next: ask the agent for a video - the skill triggers on its own."
  echo "First run in the repo:  npm install  &&  pip install -r requirements.txt  &&  python scripts/studio.py doctor"
  echo
  echo "Deep check (links, frontmatter, every file an agent needs):"
  python "$here/scripts/install_check.py" || true
fi
