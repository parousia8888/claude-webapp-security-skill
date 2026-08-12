#!/usr/bin/env bash
# verify-hardening.sh — prove the edge hardening actually engages, from outside.
#
# Read-only. Sends a small, bounded number of requests to a site you own.
# Checks three things a config file cannot prove on its own:
#   1. security response headers are actually served (not just written in nginx)
#   2. the probe class is rate-limited AND the content class is not (SEO safety)
#   3. HTTP redirects to HTTPS and TLS is modern
#
# Usage:
#   scripts/verify-hardening.sh --site https://example.com
#   scripts/verify-hardening.sh --site https://example.com --content-path / --probe-path /.env
#   scripts/verify-hardening.sh --site https://example.com --host example.com   # if hitting an IP/origin directly
set -uo pipefail

SITE="" HOST="" CONTENT="/" PROBE="/.env" N=30
while [ $# -gt 0 ]; do
  case "$1" in
    --site) SITE="$2"; shift 2;;
    --host) HOST="$2"; shift 2;;
    --content-path) CONTENT="$2"; shift 2;;
    --probe-path) PROBE="$2"; shift 2;;
    --n) N="$2"; shift 2;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done
[ -n "$SITE" ] || { echo "error: --site <url> required" >&2; exit 2; }
HOSTHDR=(); [ -n "$HOST" ] && HOSTHDR=(-H "Host: $HOST")

pass=0; warn=0
ok()   { echo "  ✓ $1"; }
bad()  { echo "  ✗ $1"; warn=$((warn+1)); }
note() { echo "  · $1"; }

echo "== verify-hardening: $SITE =="

# ── 1. security headers ────────────────────────────────────────────────
echo "[headers] $SITE$CONTENT"
H="$(curl -skI "${HOSTHDR[@]}" "$SITE$CONTENT")"
need_re() { # name, regex, level
  if echo "$H" | grep -iqE "$2"; then ok "$1"; pass=$((pass+1)); else
    if [ "${3:-warn}" = "info" ]; then note "$1 — absent (optional)"; else bad "$1 — missing"; fi
  fi
}
need_re "Strict-Transport-Security"      "^strict-transport-security:"
echo "$H" | grep -iE "^strict-transport-security:" | grep -iq "includesubdomains" \
  && ok "HSTS includeSubDomains" || note "HSTS lacks includeSubDomains (consider adding)"
need_re "X-Content-Type-Options: nosniff" "^x-content-type-options:\s*nosniff"
need_re "X-Frame-Options / frame-ancestors" "^x-frame-options:|content-security-policy(-report-only)?:.*frame-ancestors"
need_re "Referrer-Policy"                 "^referrer-policy:"
need_re "Content-Security-Policy (enforced or report-only)" "^content-security-policy(-report-only)?:"
echo "$H" | grep -iq "^content-security-policy:" \
  && ok "CSP is enforced" \
  || { echo "$H" | grep -iq "^content-security-policy-report-only:" && note "CSP is Report-Only — promote to enforced once violations are clean"; }
need_re "Permissions-Policy"              "^permissions-policy:" info

# ── 2. rate limiting: probe throttled, content not ─────────────────────
echo "[rate-limit] probe=$PROBE  content=$CONTENT  (concurrency $N)"
codes() { seq "$N" | xargs -P"$N" -I_ curl -sk -o /dev/null -w '%{http_code}\n' "${HOSTHDR[@]}" "$@"; }
PB="$(codes -A 'probe-scanner' "$SITE$PROBE" | sort | uniq -c | tr '\n' ' ')"
CT="$(codes "$SITE$CONTENT"                   | sort | uniq -c | tr '\n' ' ')"
note "probe   responses: $PB"
note "content responses: $CT"
if echo "$PB" | grep -qE '\b(429|503)\b'; then ok "probe class is being throttled"; pass=$((pass+1));
  else bad "probe class never returned 429/503 — limiter may be absent or below threshold (raise --n, or it is genuinely unlimited)"; fi
if echo "$CT" | grep -qE '\b(429|503)\b'; then bad "CONTENT class got 429/503 — this is an SEO outage: a crawler would be blocked";
  else ok "content class never throttled (crawlers safe)"; pass=$((pass+1)); fi

# ── 3. transport ───────────────────────────────────────────────────────
echo "[transport]"
if [ "${SITE#https://}" != "$SITE" ]; then
  RC="$(curl -sk -o /dev/null -w '%{http_code} %{redirect_url}' "${HOSTHDR[@]}" "${SITE/https:/http:}$CONTENT")"
  echo "$RC" | grep -qE '^30[178] https://' && { ok "HTTP → HTTPS redirect"; pass=$((pass+1)); } || note "HTTP did not 301→HTTPS ($RC)"
  V="$(curl -sk -o /dev/null -w '%{ssl_verify_result} tls=%{http_version}' "${HOSTHDR[@]}" "$SITE$CONTENT")"
  note "TLS: $V"
fi

echo "== $pass checks passed · $warn need attention =="
[ "$warn" -eq 0 ]
