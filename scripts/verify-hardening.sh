#!/usr/bin/env bash
# verify-hardening.sh — verify externally observable edge hardening.
#
# Passive mode sends one request per transport/header check. Rate-limit verification is
# active and must be enabled explicitly with --active-rate-limit after Phase 0 authorization.
# Portable to macOS Bash 3.2.
set -uo pipefail

usage() {
  sed -n '2,16p' "$0"
  cat <<'EOF'
# Usage:
#   scripts/verify-hardening.sh --site https://example.com
#   scripts/verify-hardening.sh --site https://example.com --active-rate-limit --acknowledge-authorization --n 30
#   scripts/verify-hardening.sh --site https://1.2.3.4 --host example.com
#
# Options:
#   --site URL             Required http(s) origin
#   --host HOST            Override Host header for an origin/IP check
#   --http-site URL        HTTP origin used for redirect check (default: SITE with http scheme)
#   --content-path PATH    Public content path (default /)
#   --probe-path PATH      Probe path for active limiting (default /.env)
#   --active-rate-limit    Send the bounded concurrent rate-limit checks
#   --acknowledge-authorization
#                          Confirm ownership or written authorization for the active test
#   --n COUNT              Requests per class, 1..100 (default 30)
EOF
}

SITE="" HTTP_SITE="" HOST="" CONTENT="/" PROBE="/.env" N=30 ACTIVE_RATE_LIMIT=0 ACKNOWLEDGED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --site|--http-site|--host|--content-path|--probe-path|--n)
      [ $# -ge 2 ] || { echo "error: $1 requires a value" >&2; exit 2; }
      case "$1" in
        --site) SITE="$2";;
        --http-site) HTTP_SITE="$2";;
        --host) HOST="$2";;
        --content-path) CONTENT="$2";;
        --probe-path) PROBE="$2";;
        --n) N="$2";;
      esac
      shift 2;;
    --active-rate-limit) ACTIVE_RATE_LIMIT=1; shift;;
    --acknowledge-authorization) ACKNOWLEDGED=1; shift;;
    -h|--help) usage; exit 0;;
    *) echo "unknown arg: $1" >&2; exit 2;;
  esac
done

[ -n "$SITE" ] || { echo "error: --site <url> required" >&2; exit 2; }
case "$SITE" in http://*|https://*) ;; *) echo "error: --site must start with http:// or https://" >&2; exit 2;; esac
if [ -n "$HTTP_SITE" ]; then
  case "$HTTP_SITE" in http://*) ;; *) echo "error: --http-site must start with http://" >&2; exit 2;; esac
fi
case "$N" in ''|*[!0-9]*) echo "error: --n must be an integer from 1 to 100" >&2; exit 2;; esac
[ "$N" -ge 1 ] && [ "$N" -le 100 ] || { echo "error: --n must be an integer from 1 to 100" >&2; exit 2; }
case "$CONTENT" in /*) ;; *) echo "error: --content-path must start with /" >&2; exit 2;; esac
case "$PROBE" in /*) ;; *) echo "error: --probe-path must start with /" >&2; exit 2;; esac
[ "$ACTIVE_RATE_LIMIT" -ne 1 ] || [ "$ACKNOWLEDGED" -eq 1 ] || {
  echo "error: --active-rate-limit requires --acknowledge-authorization" >&2
  exit 2
}

hcurl() { if [ -n "$HOST" ]; then curl -H "Host: $HOST" "$@"; else curl "$@"; fi; }

pass=0; warn=0; unknown=0
ok()      { echo "  [ok] $1"; pass=$((pass+1)); }
bad()     { echo "  [fail] $1"; warn=$((warn+1)); }
unknown() { echo "  [unknown] $1"; unknown=$((unknown+1)); }
note()    { echo "  [note] $1"; }

echo "== verify-hardening: $SITE =="

echo "[headers] $SITE$CONTENT"
H=""
if ! H="$(hcurl -skS --connect-timeout 5 --max-time 15 -I "$SITE$CONTENT")"; then
  bad "header request failed; no header conclusion is possible"
fi
need_re() {
  if printf '%s' "$H" | grep -iqE "$2"; then ok "$1"; else
    if [ "${3:-warn}" = "info" ]; then note "$1 — absent (optional)"; else bad "$1 — missing"; fi
  fi
}
need_re "Strict-Transport-Security" "^strict-transport-security:"
printf '%s' "$H" | grep -iE "^strict-transport-security:" | grep -iq "includesubdomains" \
  && ok "HSTS includeSubDomains" || note "HSTS lacks includeSubDomains (consider adding)"
need_re "X-Content-Type-Options: nosniff" "^x-content-type-options:[[:space:]]*nosniff"
need_re "X-Frame-Options / frame-ancestors" "^x-frame-options:|content-security-policy(-report-only)?:.*frame-ancestors"
need_re "Referrer-Policy" "^referrer-policy:"
need_re "Content-Security-Policy (enforced or report-only)" "^content-security-policy(-report-only)?:"
need_re "Permissions-Policy" "^permissions-policy:" info

echo "[rate-limit]"
if [ "$ACTIVE_RATE_LIMIT" -ne 1 ]; then
  note "skipped; pass --active-rate-limit only after scope/authorization is recorded"
else
  echo "  probe=$PROBE content=$CONTENT concurrency=$N"
  burst() {
    local url="$1" ua="${2:-}" i=0
    while [ "$i" -lt "$N" ]; do
      if [ -n "$ua" ]; then
        hcurl -skS --connect-timeout 5 --max-time 15 -o /dev/null -A "$ua" -w '%{http_code}\n' "$url" 2>/dev/null &
      else
        hcurl -skS --connect-timeout 5 --max-time 15 -o /dev/null -w '%{http_code}\n' "$url" 2>/dev/null &
      fi
      i=$((i+1))
    done
    wait
  }
  PB="$(burst "$SITE$PROBE" 'probe-scanner' | sort | uniq -c | tr '\n' ' ')"
  CT="$(burst "$SITE$CONTENT" | sort | uniq -c | tr '\n' ' ')"
  note "probe responses: $PB"
  note "content responses: $CT"
  if printf '%s %s' "$PB" "$CT" | grep -qE '(^|[^0-9])000([^0-9]|$)'; then
    bad "one or more requests failed at the network/TLS layer (HTTP 000); rate-limit result is unknown"
  else
    if printf '%s' "$PB" | grep -qE '(^|[^0-9])(429|503)([^0-9]|$)'; then
      ok "probe class is being throttled"
    else
      bad "probe class never returned 429/503 — limiter absent or below threshold"
    fi
    if printf '%s' "$CT" | grep -qE '(^|[^0-9])(429|503)([^0-9]|$)'; then
      bad "content class got 429/503 — normal users and crawlers can be blocked"
    else
      ok "content class remained available"
    fi
  fi
fi

echo "[transport]"
case "$SITE" in
  https://*)
    [ -n "$HTTP_SITE" ] || HTTP_SITE="$(printf '%s' "$SITE" | sed 's,^https:,http:,')"
    RC="$(hcurl -skS --connect-timeout 5 --max-time 15 -o /dev/null -w '%{http_code} %{redirect_url}' "$HTTP_SITE$CONTENT" 2>/dev/null || true)"
    case "$RC" in
      30[12378]\ https://*) ok "HTTP redirects to HTTPS ($RC)";;
      000*|'') unknown "HTTP redirect endpoint was unreachable";;
      *) bad "HTTP did not redirect to HTTPS ($RC)";;
    esac

    if curl --help all 2>/dev/null | grep -q -- '--tls-max'; then
      if hcurl -skS --connect-timeout 5 --max-time 15 --tlsv1.2 --tls-max 1.2 -o /dev/null "$SITE$CONTENT" 2>/dev/null; then
        ok "TLS 1.2 handshake succeeds"
      else
        bad "TLS 1.2 handshake failed"
      fi
      if hcurl -skS --connect-timeout 5 --max-time 15 --tlsv1.1 --tls-max 1.1 -o /dev/null "$SITE$CONTENT" 2>/dev/null; then
        bad "TLS 1.1 handshake succeeds; disable TLS 1.1"
      else
        ok "TLS 1.1 handshake rejected"
      fi
      if hcurl -skS --connect-timeout 5 --max-time 15 --tlsv1.0 --tls-max 1.0 -o /dev/null "$SITE$CONTENT" 2>/dev/null; then
        bad "TLS 1.0 handshake succeeds; disable TLS 1.0"
      else
        ok "TLS 1.0 handshake rejected"
      fi
    else
      unknown "curl lacks --tls-max; minimum TLS version was not verified"
    fi

    if [ -z "$HOST" ]; then
      if curl -sS --connect-timeout 5 --max-time 15 -o /dev/null "$SITE$CONTENT"; then
        ok "TLS certificate chain and hostname validate"
      else
        bad "TLS certificate chain or hostname validation failed"
      fi
    else
      unknown "certificate validation skipped for --host origin/IP mode"
    fi
    ;;
  *) note "site is not https://; TLS checks skipped";;
esac

echo "== $pass passed · $warn failed · $unknown unknown =="
[ "$warn" -eq 0 ] && [ "$unknown" -eq 0 ]
