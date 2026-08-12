#!/usr/bin/env bash
# verify-hardening.sh — prove edge hardening actually engages, from outside.
#
# PASSIVE by default (read-only, one request per check): security headers, TLS policy,
# certificate, HTTP→HTTPS redirect. The rate-limit probe is ACTIVE (many concurrent
# requests) and only runs with --active-rate-limit, which prints the request volume and an
# authorization reminder — you must own or be authorized to test the target.
#
# Usage:
#   scripts/verify-hardening.sh --site https://example.com
#   scripts/verify-hardening.sh --site https://example.com --active-rate-limit --n 30
#   scripts/verify-hardening.sh --site https://1.2.3.4 --host example.com    # origin/IP directly
#
# Exit: 2 = bad arguments; 1 = at least one check failed or errored; 0 = all clear.
# Portable to macOS Bash 3.2.
set -uo pipefail

SITE="" HOST="" CONTENT="/" PROBE="/.env" N=30 ACTIVE_RL=0
die2() { echo "error: $1" >&2; exit 2; }
while [ $# -gt 0 ]; do
  case "$1" in
    --site) [ $# -ge 2 ] || die2 "--site needs a value"; SITE="$2"; shift 2;;
    --host) [ $# -ge 2 ] || die2 "--host needs a value"; HOST="$2"; shift 2;;
    --content-path) [ $# -ge 2 ] || die2 "--content-path needs a value"; CONTENT="$2"; shift 2;;
    --probe-path) [ $# -ge 2 ] || die2 "--probe-path needs a value"; PROBE="$2"; shift 2;;
    --n) [ $# -ge 2 ] || die2 "--n needs a value"; N="$2"; shift 2;;
    --active-rate-limit) ACTIVE_RL=1; shift;;
    -h|--help) echo "usage: $0 --site <url> [--host h] [--content-path p] [--probe-path p] [--active-rate-limit [--n 1-100]]"; exit 0;;
    *) die2 "unknown argument: $1";;
  esac
done
[ -n "$SITE" ] || die2 "--site <url> is required"
case "$SITE" in http://*|https://*) : ;; *) die2 "--site must be http(s)://…";; esac
case "$N" in ''|*[!0-9]*) die2 "--n must be an integer";; esac
if [ "$N" -lt 1 ] || [ "$N" -gt 100 ]; then die2 "--n must be between 1 and 100"; fi

hcurl() { if [ -n "$HOST" ]; then curl -H "Host: $HOST" "$@"; else curl "$@"; fi; }

pass=0; warn=0
ok()   { echo "  ✓ $1"; pass=$((pass+1)); }
bad()  { echo "  ✗ $1"; warn=$((warn+1)); }
err()  { echo "  ! $1 (ERROR/UNKNOWN — not a pass)"; warn=$((warn+1)); }
note() { echo "  · $1"; }

echo "== verify-hardening: $SITE =="

# ── 1. security headers ─────────────────────────────────────────────────
echo "[headers] $SITE$CONTENT"
H="$(hcurl -skI "$SITE$CONTENT" 2>/dev/null)"; rc=$?
if [ $rc -ne 0 ] || [ -z "$H" ]; then
  err "could not fetch headers (curl exit $rc) — target unreachable?"
else
  need() { if printf '%s' "$H" | grep -iqE "$2"; then ok "$1"; else [ "${3:-}" = info ] && note "$1 — absent (optional)" || bad "$1 — missing"; fi; }
  need "Strict-Transport-Security" "^strict-transport-security:"
  printf '%s' "$H" | grep -iE "^strict-transport-security:" | grep -iq "includesubdomains" && ok "HSTS includeSubDomains" || note "HSTS lacks includeSubDomains"
  need "X-Content-Type-Options: nosniff" "^x-content-type-options:[[:space:]]*nosniff"
  need "X-Frame-Options / frame-ancestors" "^x-frame-options:|content-security-policy(-report-only)?:.*frame-ancestors"
  need "Referrer-Policy" "^referrer-policy:"
  need "Content-Security-Policy (enforced or report-only)" "^content-security-policy(-report-only)?:"
  printf '%s' "$H" | grep -iq "^content-security-policy:" && ok "CSP enforced" \
    || { printf '%s' "$H" | grep -iq "^content-security-policy-report-only:" && note "CSP is Report-Only — promote once violations are clean"; }
  need "Permissions-Policy" "^permissions-policy:" info
fi

# ── 2. transport: TLS policy + certificate + redirect ───────────────────
echo "[transport]"
case "$SITE" in
  https://*)
    # HTTP → HTTPS redirect (accept 301/302/303/307/308)
    HTTP_URL="$(printf '%s' "$SITE" | sed 's,^https:,http:,')"
    RC="$(hcurl -sk -o /dev/null -w '%{http_code} %{redirect_url}' "$HTTP_URL$CONTENT" 2>/dev/null)"
    case "$RC" in 30[1235678]" "https://*) ok "HTTP → HTTPS redirect ($RC)";; *) bad "no HTTP→HTTPS redirect ($RC)";; esac

    # TLS PROTOCOL policy — actively prove old TLS is refused and modern TLS works.
    # (%{ssl_version} is NOT a curl write-out variable; the only reliable check is to force a
    #  version and observe the handshake.) -k isolates the protocol test from cert validity.
    if curl --help all 2>/dev/null | grep -q -- '--tls-max'; then
      if hcurl -sk --tls-max 1.1 -o /dev/null "$SITE$CONTENT" 2>/dev/null; then
        bad "server ACCEPTS TLS ≤ 1.1 (a --tls-max 1.1 handshake succeeded)"
      else
        ok "TLS ≤ 1.1 refused"
      fi
    else
      note "this curl has no --tls-max; cannot prove old-TLS refusal (upgrade curl, or use testssl.sh/sslyze)"
    fi
    if hcurl -sk --tlsv1.2 -o /dev/null "$SITE$CONTENT" 2>/dev/null; then ok "TLS 1.2+ works"; else bad "TLS 1.2+ handshake failed"; fi

    # Certificate chain: without -k, so an invalid/expired/mismatched cert is a real finding.
    # Skipped when --host is set (name mismatch against an IP/origin is expected there).
    if [ -z "$HOST" ]; then
      if curl -s -o /dev/null "$SITE$CONTENT" 2>/dev/null; then ok "TLS certificate chain validates"; else bad "TLS certificate chain does NOT validate"; fi
    else
      note "cert chain not checked (--host set)"
    fi
    ;;
  *) note "site is not https:// — skipping transport checks";;
esac

# ── 3. rate limiting (ACTIVE — opt-in) ──────────────────────────────────
echo "[rate-limit]"
if [ "$ACTIVE_RL" -ne 1 ]; then
  note "skipped — this is an ACTIVE test ($N concurrent requests). Re-run with --active-rate-limit on a target you own."
else
  echo "  ⚠ ACTIVE: sending $N concurrent requests each to $PROBE and $CONTENT. Authorized targets only."
  burst() { # url, ua(optional)
    local url="$1" ua="${2:-}" i=0
    while [ "$i" -lt "$N" ]; do
      if [ -n "$ua" ]; then hcurl -sk -o /dev/null -A "$ua" -w '%{http_code}\n' "$url" & else hcurl -sk -o /dev/null -w '%{http_code}\n' "$url" & fi
      i=$((i+1))
    done
    wait
  }
  PB="$(burst "$SITE$PROBE" 'probe-scanner' | sort | uniq -c | tr '\n' ' ')"
  CT="$(burst "$SITE$CONTENT" | sort | uniq -c | tr '\n' ' ')"
  note "probe   responses: $PB"
  note "content responses: $CT"
  # Failure semantics: 000/curl-error is UNKNOWN, never "safe".
  if printf '%s' "$PB" | grep -qE '(^| )000( |$)|000'; then err "probe requests returned 000 (connection/DNS/timeout failure) — inconclusive"
  elif printf '%s' "$PB" | grep -qE '429|503'; then ok "probe class is throttled"
  else bad "probe class never returned 429/503 — limiter absent, below threshold, or genuinely unlimited"; fi
  if printf '%s' "$CT" | grep -qE '(^| )000( |$)|000'; then err "content requests returned 000 — target unreachable, result inconclusive (NOT proof of safety)"
  elif printf '%s' "$CT" | grep -qE '429|503'; then bad "CONTENT class got 429/503 — SEO outage: a crawler would be blocked"
  else ok "content class not throttled (crawlers safe)"; fi
fi

echo "== $pass passed · $warn need attention =="
[ "$warn" -eq 0 ]
