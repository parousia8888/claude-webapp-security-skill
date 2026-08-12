#!/usr/bin/env bash
# Real gate for the shell tools: exit-code contracts + no unbound-variable crash on Bash 3.2.
set -u
H="$(dirname "$0")/../scripts/verify-hardening.sh"
f=0
exp() { local want=$1; shift; bash "$H" "$@" >/dev/null 2>&1; local rc=$?; [ "$rc" = "$want" ] || { echo "✗ want exit $want, got $rc:  $*"; f=1; }; }
exp 2 --n 0 --site https://x           # bad --n
exp 2                                   # missing --site
exp 2 --site ftp://x                    # non-http scheme
exp 2 --n nope --site https://x         # non-numeric --n
exp 2 --site https://x --n 101          # out of range
out="$(bash "$H" --site https://127.0.0.1:1 2>&1)"
printf '%s' "$out" | grep -qi 'unbound variable' && { echo "✗ unbound-variable crash"; f=1; }
printf '%s' "$out" | grep -q 'verify-hardening' || { echo "✗ script did not run"; f=1; }
printf '%s' "$out" | grep -q 'skipped' || { echo "✗ rate-limit not opt-in by default"; f=1; }
[ "$f" = 0 ] && echo "✓ shell-smoke: exit-code contracts + Bash 3.2 + passive-default hold" || exit 1
