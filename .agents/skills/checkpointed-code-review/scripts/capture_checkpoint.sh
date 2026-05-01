#!/usr/bin/env bash
set -euo pipefail

checkpoint_namespace="refs/tiara-review-checkpoints"
prefix="$checkpoint_namespace"
checkpoint_ref=""

usage() {
  cat <<'USAGE'
Usage: capture_checkpoint.sh [--ref <ref>] [--prefix <prefix>]

Creates a hidden Git-ref checkpoint for the current working directory without
modifying the current branch or the user's real Git index.

Ref constraints:
  --prefix must be refs/tiara-review-checkpoints or a descendant.
  --ref must be a descendant of the active prefix.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "error: --ref requires a value" >&2
        exit 2
      fi
      checkpoint_ref="$2"
      shift 2
      ;;
    --prefix)
      if [[ $# -lt 2 || -z "$2" ]]; then
        echo "error: --prefix requires a value" >&2
        exit 2
      fi
      prefix="${2%/}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" != "true" ]]; then
  echo "error: must be run inside a Git working tree" >&2
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
created_at="$(date +%s)"

if [[ "$prefix" != "$checkpoint_namespace" && "$prefix" != "$checkpoint_namespace"/* ]]; then
  echo "error: checkpoint prefix must be under ${checkpoint_namespace}/ (got: $prefix)" >&2
  exit 2
fi

if [[ -z "$checkpoint_ref" ]]; then
  random_suffix="$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"
  checkpoint_ref="${prefix}/${created_at}-${random_suffix}"
fi

if [[ "$checkpoint_ref" != "$prefix"/* ]]; then
  echo "error: checkpoint ref must be under ${prefix}/ (got: $checkpoint_ref)" >&2
  exit 2
fi

head_commit=""
if git -C "$repo_root" rev-parse --verify --quiet HEAD^{commit} >/dev/null; then
  head_commit="$(git -C "$repo_root" rev-parse --verify HEAD^{commit})"
fi

temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/tiara-review-checkpoint.XXXXXX")"
temp_index="${temp_dir}/index"

(
  cd "$repo_root"
  trap 'rm -rf "$temp_dir"' EXIT
  export GIT_INDEX_FILE="$temp_index"
  export GIT_AUTHOR_NAME="${GIT_AUTHOR_NAME:-Tiara Code Review}"
  export GIT_AUTHOR_EMAIL="${GIT_AUTHOR_EMAIL:-tiara-code-review@users.noreply.github.com}"
  export GIT_COMMITTER_NAME="${GIT_COMMITTER_NAME:-Tiara Code Review}"
  export GIT_COMMITTER_EMAIL="${GIT_COMMITTER_EMAIL:-tiara-code-review@users.noreply.github.com}"
  export GIT_AUTHOR_DATE="@${created_at}"
  export GIT_COMMITTER_DATE="@${created_at}"

  if [[ -n "$head_commit" ]]; then
    git read-tree HEAD
  fi

  # Captures tracked changes and unignored untracked files; gitignored files are excluded.
  git add -A -- .
  # `set -e` propagates failures from Git plumbing commands below.
  tree_oid="$(git write-tree)"

  commit_args=("$tree_oid")
  if [[ -n "$head_commit" ]]; then
    commit_args+=("-p" "$head_commit")
  fi
  commit_args+=("-m" "tiara review checkpoint ref=${checkpoint_ref}")

  commit_oid="$(git commit-tree --no-gpg-sign "${commit_args[@]}")"

  git update-ref "$checkpoint_ref" "$commit_oid"

  printf 'checkpoint_ref=%s\n' "$checkpoint_ref"
  printf 'checkpoint_commit=%s\n' "$commit_oid"
  printf 'head_commit=%s\n' "$head_commit"
  printf 'created_at=%s\n' "$created_at"
  printf 'working_dir_only=true\n'
)
