#!/usr/bin/env bash
# verify-hardening.sh — prove the edge hardening actually engages, from outside.
#
# Read-only. Sends a small, bounded number of requests to a site you own.
# Checks three things a config file cannot prove on its own:
#   1. security response headers are actually served (not just written in nginx)
#   2. the probe class is rate-limited AND the content class is not (SEO safety)
#   3. HTTP redirects to HTTPS, the negotiated TLS *protocol* is modern, and (for a bare
#      public hostname) the certificate chain validates
#
# Usage:
#   scripts/verify-hardening.sh --site https://example.com
#   scripts/verify-hardening.sh --site https://example.com --content-path / --probe-path /.env
#   scripts/verify-hardening.sh --site https://1.2.3.4 --host example.com   # hitting an IP/origin directly
#
# Portable to macOS's Bash 3.2 (no `${arr[@]}` under `set -u` when empty; no mapfile).
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

# Host header as a plain string, not an array: Bash 3.2 errors on an empty "${arr[@]}"
# expansion under `set -u`, which broke this script on stock macOS. `curl -H ""` is a no-op,
# so an empty HOSTOPT is safe to always pass.
HOSTOPT_K=(); HOSTOPT_V=""
if [ -n "$HOST" ]; then HOSTOPT_V="Host: $HOST"; fi
# helper: run curl with the optional Host header, no array expansion pitfalls
hcurl() { if [ -n "$HOSTOPT_V" ]; then curl -H "$HOSTOPT_V" "$@"; else curl "$@"; fi; }

pass=0; warn=0
ok()   { echo "  ✓ $1"; }
bad()  { echo "  ✗ $1"; warn=$((warn+1)); }
note() { echo "  · $1"; }

echo "== verify-hardening: $SITE =="

# ── 1. security headers ────────────────────────────────────────────────
echo "[headers] $SITE$CONTENT"
H="$(hcurl -skI "$SITE$CONTENT")"
need_re() { # name, regex, level(optional=warn|info)
  if printf '%s' "$H" | grep -iqE "$2"; then ok "$1"; pass=$((pass+1)); else
    if [ "${3:-warn}" = "info" ]; then note "$1 — absent (optional)"; else bad "$1 — missing"; fi
  fi
}
need_re "Strict-Transport-Security"      "^strict-transport-security:"
printf '%s' "$H" | grep -iE "^strict-transport-security:" | grep -iq "includesubdomains" \
  && ok "HSTS includeSubDomains" || note "HSTS lacks includeSubDomains (consider adding)"
need_re "X-Content-Type-Options: nosniff" "^x-content-type-options:[[:space:]]*nosniff"
need_re "X-Frame-Options / frame-ancestors" "^x-frame-options:|content-security-policy(-report-only)?:.*frame-ancestors"
need_re "Referrer-Policy"                 "^referrer-policy:"
need_re "Content-Security-Policy (enforced or report-only)" "^content-security-policy(-report-only)?:"
printf '%s' "$H" | grep -iq "^content-security-policy:" \
  && ok "CSP is enforced" \
  || { printf '%s' "$H" | grep -iq "^content-security-policy-report-only:" && note "CSP is Report-Only — promote to enforced once violations are clean"; }
need_re "Permissions-Policy"              "^permissions-policy:" info

# ── 2. rate limiting: probe throttled, content not ─────────────────────
echo "[rate-limit] probe=$PROBE  content=$CONTENT  (concurrency $N)"
burst() { # url, ua(optional): fire N concurrent requests, print sorted status tally
  local url="$1" ua="${2:-}"
  local i=0
  while [ "$i" -lt "$N" ]; do
    if [ -n "$ua" ]; then hcurl -sk -o /dev/null -A "$ua" -w '%{http_code}\n' "$url" &
    else hcurl -sk -o /dev/null -w '%{http_code}\n' "$url" &
    fi
    i=$((i+1))
  done
  wait
}
PB="$(burst "$SITE$PROBE" 'probe-scanner' | sort | uniq -c | tr '\n' ' ')"
CT="$(burst "$SITE$CONTENT"                | sort | uniq -c | tr '\n' ' ')"
note "probe   responses: $PB"
note "content responses: $CT"
if printf '%s' "$PB" | grep -qE '(^| )(429|503)( |$)|[^0-9](429|503)[^0-9]'; then ok "probe class is being throttled"; pass=$((pass+1));
  else bad "probe class never returned 429/503 — limiter absent or below threshold (raise --n, or it is genuinely unlimited)"; fi
if printf '%s' "$CT" | grep -qE '429|503'; then bad "CONTENT class got 429/503 — SEO outage: a crawler would be blocked";
  else ok "content class never throttled (crawlers safe)"; pass=$((pass+1)); fi

# ── 3. transport ───────────────────────────────────────────────────────
echo "[transport]"
case "$SITE" in
  https://*)
    RC="$(hcurl -sk -o /dev/null -w '%{http_code} %{redirect_url}' "$(printf '%s' "$SITE" | sed 's,^https:,http:,')$CONTENT")"
    printf '%s' "$RC" | grep -qE '^30[178] https://' && { ok "HTTP → HTTPS redirect"; pass=$((pass+1)); } || note "HTTP did not 30x→HTTPS ($RC)"

    # negotiated TLS PROTOCOL version (TLSv1.2 / TLSv1.3) — NOT the HTTP version
    TLSV="$(hcurl -sk -o /dev/null -w '%{ssl_version}' "$SITE$CONTENT")"
    case "$TLSV" in
      TLSv1.3|TLSv1.2) ok "TLS $TLSV"; pass=$((pass+1));;
      "") note "TLS version not reported (old curl); check manually";;
      *) bad "weak/again TLS: '$TLSV' (want TLSv1.2 or TLSv1.3)";;
    esac

    # cert chain: the header/rate checks used -k so an IP+Host test still works. For a bare
    # public hostname, also verify the chain WITHOUT -k — an invalid cert is a real finding.
    if [ -z "$HOST" ]; then
      if curl -s -o /dev/null "$SITE$CONTENT"; then ok "TLS certificate chain validates"; pass=$((pass+1));
        else bad "TLS certificate chain does NOT validate (curl without -k failed)"; fi
    else
      note "cert chain not checked (--host set → testing an origin/IP with a name mismatch is expected)"
    fi
    ;;
  *) note "site is not https:// — skipping transport checks";;
esac

echo "== $pass checks passed · $warn need attention =="
[ "$warn" -eq 0 ]
