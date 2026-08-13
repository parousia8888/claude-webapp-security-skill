#!/usr/bin/env bash
set -euo pipefail

: "${INPUT_SITE:?INPUT_SITE is required}"
: "${INPUT_ACKNOWLEDGE_AUTHORIZATION:?INPUT_ACKNOWLEDGE_AUTHORIZATION is required}"
INPUT_OUTPUT_DIR="${INPUT_OUTPUT_DIR:-webapp-security-report}"
INPUT_FAIL_ON="${INPUT_FAIL_ON:-high}"
INPUT_FAIL_ON_DOMAIN="${INPUT_FAIL_ON_DOMAIN:-}"
INPUT_ACTIVE_PROBE="${INPUT_ACTIVE_PROBE:-false}"

if [ "$INPUT_ACKNOWLEDGE_AUTHORIZATION" != "true" ]; then
  echo "acknowledge-authorization must be true" >&2
  exit 2
fi

ACTION_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
args=(
  --site "$INPUT_SITE"
  --out "$INPUT_OUTPUT_DIR"
  --report-name report
  --fail-on "$INPUT_FAIL_ON"
)
if [ -n "$INPUT_FAIL_ON_DOMAIN" ]; then
  args+=(--fail-on-domain "$INPUT_FAIL_ON_DOMAIN")
fi
if [ "$INPUT_ACTIVE_PROBE" = "true" ]; then
  args+=(--active-probe --acknowledge-authorization)
elif [ "$INPUT_ACTIVE_PROBE" != "false" ]; then
  echo "active-probe must be true or false" >&2
  exit 2
fi

summary_file="$(mktemp "${RUNNER_TEMP:-/tmp}/webapp-security-summary.XXXXXX")"
trap 'rm -f "$summary_file"' EXIT
set +e
node "$ACTION_ROOT/scripts/crawl-surface-audit.mjs" "${args[@]}" > "$summary_file"
status=$?
set -e
cat "$summary_file"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  cat "$summary_file" >> "$GITHUB_STEP_SUMMARY"
fi
exit "$status"
