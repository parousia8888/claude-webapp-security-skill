#!/usr/bin/env bash
# aws-exposure-audit.sh — read-only AWS posture inventory for a web app account.
#
# Only describe/list/get calls. Nothing is created, modified, or deleted.
# Checks that fail due to missing IAM permissions are reported as UNCHECKED,
# never as passing. See ../references/aws-hardening.md for what to do with the output.
#
# Usage:
#   bash aws-exposure-audit.sh [--profile NAME] [--region REGION] [--out DIR]

set -uo pipefail

PROFILE=""
REGION="${AWS_REGION:-us-east-1}"
OUT_DIR=""

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="$2"; shift 2 ;;
    --region)  REGION="$2";  shift 2 ;;
    --out)     OUT_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

command -v aws >/dev/null 2>&1 || { echo "aws cli not found" >&2; exit 2; }

AWS=(aws)
[ -n "$PROFILE" ] && AWS+=(--profile "$PROFILE")
AWS+=(--region "$REGION" --output text --no-cli-pager)

REPORT=""
HIGH=0; MED=0; LOW=0; UNCHECKED=0
RUN_OUT=""

say()   { REPORT+="$1"$'\n'; printf '%s\n' "$1"; }
head2() { say ""; say "## $1"; say ""; }
finding() {
  case "$1" in
    HIGH) HIGH=$((HIGH+1)) ;;
    MED)  MED=$((MED+1)) ;;
    LOW)  LOW=$((LOW+1)) ;;
  esac
  say "- **[$1]** $2"
}
ok()   { say "- [ok] $1"; }
note() { say "- $1"; }
skip() { UNCHECKED=$((UNCHECKED+1)); say "- _[UNCHECKED] $1_"; }
sanitize_error() {
  # AWS/SSO wrappers can echo credentials or session material in an error. The
  # operation name is already in the report; keep the captured payload private.
  printf '%s' 'AWS CLI call failed; details withheld'
}

# run <description> <aws args...>  → sets RUN_OUT, returns non-zero on failure.
# Must NOT be called inside $( ), or skip()/counters run in a lost subshell.
run() {
  local desc="$1"; shift
  if RUN_OUT="$("${AWS[@]}" "$@" 2>&1)"; then
    [ "$RUN_OUT" = "None" ] && RUN_OUT=""   # empty JMESPath result
    return 0
  fi
  skip "$desc — $(sanitize_error "$RUN_OUT")"
  RUN_OUT=""
  return 1
}
count() { set -- $1; echo $#; }

epoch_of() { # ISO8601 → epoch seconds, portable-ish
  local t="${1%%+*}"; t="${t%%.*}"
  date -u -j -f "%Y-%m-%dT%H:%M:%S" "$t" +%s 2>/dev/null || date -u -d "$1" +%s 2>/dev/null || echo 0
}

say "# AWS exposure audit"
say ""
say "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ) · region: \`$REGION\` · profile: \`${PROFILE:-default}\`"
say ""
say "Read-only inventory. \`UNCHECKED\` means the call failed (usually a missing IAM permission) — treat it as unknown, never as passing."

# ---------------------------------------------------------------- identity
head2 "0. Caller identity"
if run 'sts get-caller-identity' sts get-caller-identity --query '[Account,Arn]'; then
  ACCOUNT="$(printf '%s' "$RUN_OUT" | awk '{print $1}')"
  note "account: \`$ACCOUNT\`"
  note "identity: \`$(printf '%s' "$RUN_OUT" | awk '{print $2}')\`"
else
  say "- cannot determine identity; aborting"
  exit 1
fi

# ---------------------------------------------------------------- iam
head2 "1. Identity and access management"

if run 'iam get-account-summary' iam get-account-summary \
     --query '[SummaryMap.AccountMFAEnabled,SummaryMap.AccountAccessKeysPresent,SummaryMap.Users]'; then
  set -- $RUN_OUT
  [ "${1:-0}" = "1" ] && ok "root account has MFA enabled" || finding HIGH "root account has **no MFA**"
  [ "${2:-0}" = "0" ] && ok "no root access keys" || finding HIGH "root account has **access keys** — delete them"
  note "IAM users: ${3:-?}"
fi

if run 'iam list-users' iam list-users --query 'Users[].UserName'; then
  users="$RUN_OUT"
  for u in $users; do
    if run "iam list-mfa-devices for $u" iam list-mfa-devices --user-name "$u" --query 'length(MFADevices)'; then
      [ "${RUN_OUT:-0}" = "0" ] && finding MED "IAM user \`$u\` has no MFA device"
    fi
    if run "iam list-access-keys for $u" iam list-access-keys --user-name "$u" --query 'AccessKeyMetadata[?Status==`Active`].[AccessKeyId,CreateDate]'; then
      keys="$RUN_OUT"
      while read -r kid kdate; do
        [ -z "${kid:-}" ] && continue
        age=$(( ( $(date -u +%s) - $(epoch_of "$kdate") ) / 86400 ))
        [ "$age" -gt 90 ] 2>/dev/null && finding MED "IAM user \`$u\` has an active access key ${age} days old (rotate ≤90d)"
      done <<< "$keys"
    fi
  done
fi

if run 'iam list-policies (attached, customer-managed)' iam list-policies --scope Local --only-attached --query 'Policies[].[PolicyName,Arn]'; then
  policies="$RUN_OUT"
  while read -r pname parn; do
    [ -z "${parn:-}" ] && continue
    if run "iam get-policy for $pname" iam get-policy --policy-arn "$parn" --query 'Policy.DefaultVersionId'; then
      ver="$RUN_OUT"
      [ -z "$ver" ] && continue
      if run "iam get-policy-version for $pname" iam get-policy-version --policy-arn "$parn" --version-id "$ver" --output json; then
        doc="$(printf '%s' "$RUN_OUT" | tr -d ' \n')"
        printf '%s' "$doc" | grep -q '"Action":"\*"' && printf '%s' "$doc" | grep -q '"Resource":"\*"' \
          && finding HIGH "attached customer policy \`$pname\` grants Action:* on Resource:*"
      fi
    fi
  done <<< "$policies"
fi

if RUN_OUT="$("${AWS[@]}" iam get-account-password-policy 2>&1)"; then
  ok "IAM account password policy configured"
elif printf '%s' "$RUN_OUT" | grep -q 'NoSuchEntity'; then
  finding LOW "no IAM account password policy configured"
else
  skip "iam get-account-password-policy — $(sanitize_error "$RUN_OUT")"
fi
RUN_OUT=""

# ---------------------------------------------------------------- network
head2 "2. Network exposure"

SENSITIVE_PORTS="22 23 445 3389 3306 5432 27017 6379 9200 9300 5601 11211 8080 8000 5000"
if run 'ec2 describe-security-groups' ec2 describe-security-groups --query 'SecurityGroups[].[GroupId,GroupName]'; then
  security_groups="$RUN_OUT"
  while read -r sgid sgname; do
    [ -z "${sgid:-}" ] && continue
    if ! run "ec2 describe-security-groups ingress for $sgid" ec2 describe-security-groups --group-ids "$sgid" \
      --query 'SecurityGroups[].IpPermissions[?contains(IpRanges[].CidrIp, `0.0.0.0/0`) || contains(Ipv6Ranges[].CidrIpv6, `::/0`)].[IpProtocol,FromPort,ToPort]'; then
      continue
    fi
    open="$RUN_OUT"; [ -z "$open" ] && continue
    while read -r proto from to; do
      [ -z "${proto:-}" ] && continue
      if [ "$proto" = "-1" ]; then
        finding HIGH "SG \`$sgid\` ($sgname) allows **all protocols and ports** from 0.0.0.0/0"
        continue
      fi
      [ "$from" = "None" ] && continue
      for p in $SENSITIVE_PORTS; do
        if [ "$from" -le "$p" ] 2>/dev/null && [ "$to" -ge "$p" ] 2>/dev/null; then
          finding HIGH "SG \`$sgid\` ($sgname) exposes port $p to the internet"
        fi
      done
      if [ "$from" = "80" ] || [ "$from" = "443" ]; then
        note "SG \`$sgid\` ($sgname) open on $from — acceptable only if this origin is CDN-locked (see aws-hardening.md §2)"
      fi
    done <<< "$open"
  done <<< "$security_groups"
fi

if run 'ec2 describe-flow-logs' ec2 describe-flow-logs --query 'FlowLogs[].FlowLogId'; then
  n=$(count "$RUN_OUT"); [ "$n" = "0" ] && finding LOW "no VPC flow logs configured" || ok "VPC flow logs: $n"
fi

# ---------------------------------------------------------------- compute
head2 "3. Compute (EC2)"

if run 'ec2 describe-instances' ec2 describe-instances \
     --query 'Reservations[].Instances[?State.Name==`running`].[InstanceId,MetadataOptions.HttpTokens,PublicIpAddress]'; then
  if [ -z "$RUN_OUT" ]; then
    note "no running instances in $REGION"
  else
    while read -r iid tokens pubip; do
      [ -z "${iid:-}" ] && continue
      if [ "$tokens" = "required" ]; then
        ok "instance \`$iid\` requires IMDSv2"
      else
        finding HIGH "instance \`$iid\` allows IMDSv1 (HttpTokens=$tokens) — any SSRF in the app can steal its role credentials"
      fi
      [ "${pubip:-None}" != "None" ] && note "instance \`$iid\` has a public IP — confirm no listener is reachable except via the CDN"
    done <<< "$RUN_OUT"
  fi
fi

if run 'ec2 get-ebs-encryption-by-default' ec2 get-ebs-encryption-by-default --query 'EbsEncryptionByDefault'; then
  [ "$RUN_OUT" = "True" ] && ok "EBS encryption by default enabled" || finding MED "EBS encryption by default is disabled"
fi

if run 'ec2 describe-snapshots (publicly restorable)' ec2 describe-snapshots --owner-ids "$ACCOUNT" --restorable-by-user-ids all --query 'length(Snapshots)'; then
  [ "${RUN_OUT:-0}" = "0" ] && ok "no publicly restorable EBS snapshots" || finding HIGH "$RUN_OUT EBS snapshot(s) are publicly restorable"
fi

if run 'ec2 describe-images (public)' ec2 describe-images --owners "$ACCOUNT" --filters "Name=is-public,Values=true" --query 'length(Images)'; then
  [ "${RUN_OUT:-0}" = "0" ] && ok "no public AMIs" || finding HIGH "$RUN_OUT AMI(s) are public"
fi

# ---------------------------------------------------------------- storage
head2 "4. Storage (S3)"

pab_err=""
if pab="$("${AWS[@]}" s3control get-public-access-block --account-id "$ACCOUNT" \
     --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]' 2>&1)"; then
  if printf '%s' "$pab" | grep -q "False"; then
    finding HIGH "account-level S3 Block Public Access is not fully enabled ($pab)"
  else
    ok "account-level S3 Block Public Access fully enabled"
  fi
elif printf '%s' "$pab" | grep -q "NoSuchPublicAccessBlockConfiguration"; then
  finding HIGH "no account-level S3 Block Public Access configuration exists — a single careless bucket policy or ACL can make data public. Enable it account-wide."
else
  skip "s3control get-public-access-block — $(sanitize_error "$pab")"
fi

if run 's3api list-buckets' s3api list-buckets --query 'Buckets[].Name'; then
  buckets="$RUN_OUT"
  for b in $buckets; do
    if run "s3api get-public-access-block for $b" s3api get-public-access-block --bucket "$b" \
      --query 'PublicAccessBlockConfiguration.[BlockPublicAcls,IgnorePublicAcls,BlockPublicPolicy,RestrictPublicBuckets]'; then
      bpab="$RUN_OUT"
      printf '%s' "$bpab" | grep -q "False" && finding MED "bucket \`$b\` does not have Block Public Access fully enabled"
    fi
    if run "s3api get-bucket-policy-status for $b" s3api get-bucket-policy-status --bucket "$b" --query 'PolicyStatus.IsPublic'; then
      [ "$RUN_OUT" = "True" ] && finding HIGH "bucket \`$b\` has a **public** bucket policy"
    fi
    if run "s3api get-bucket-encryption for $b" s3api get-bucket-encryption --bucket "$b" --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm'; then
      [ -z "$RUN_OUT" ] && finding MED "bucket \`$b\` has no default encryption"
    fi
    if run "s3api get-bucket-versioning for $b" s3api get-bucket-versioning --bucket "$b" --query 'Status'; then
      [ "${RUN_OUT:-None}" != "Enabled" ] && note "bucket \`$b\`: versioning not enabled"
    fi
  done
fi

# ---------------------------------------------------------------- databases
head2 "5. Databases"

if run 'rds describe-db-instances' rds describe-db-instances \
     --query 'DBInstances[].[DBInstanceIdentifier,PubliclyAccessible,StorageEncrypted,BackupRetentionPeriod,DeletionProtection]'; then
  [ -z "$RUN_OUT" ] && note "no RDS instances in $REGION"
  while read -r id pub enc backup delprot; do
    [ -z "${id:-}" ] && continue
    [ "$pub" = "True" ] && finding HIGH "RDS \`$id\` is **publicly accessible**"
    [ "$enc" = "False" ] && finding HIGH "RDS \`$id\` storage is not encrypted"
    [ "${backup:-0}" = "0" ] && finding HIGH "RDS \`$id\` has automated backups disabled"
    [ "$delprot" = "False" ] && finding LOW "RDS \`$id\` has deletion protection off"
  done <<< "$RUN_OUT"
fi

if run 'docdb describe-db-clusters' docdb describe-db-clusters --query 'DBClusters[].[DBClusterIdentifier,StorageEncrypted,DeletionProtection]'; then
  while read -r id enc delprot; do
    [ -z "${id:-}" ] && continue
    [ "$enc" = "False" ] && finding HIGH "DocumentDB \`$id\` is not encrypted"
    [ "$delprot" = "False" ] && finding LOW "DocumentDB \`$id\` has deletion protection off"
  done <<< "$RUN_OUT"
fi

note "self-managed MongoDB/Redis/Elasticsearch on EC2 is not visible to this script — verify from outside the VPC that their ports do not answer (phase-5-database.md §1)"

# ---------------------------------------------------------------- edge
head2 "6. Edge (CloudFront / ALB / WAF)"

if run 'cloudfront list-distributions' cloudfront list-distributions --query 'DistributionList.Items[].[Id,DomainName,WebACLId]'; then
  [ -z "$RUN_OUT" ] && note "no CloudFront distributions in this account — if the site is fronted by another CDN, check its bot/AI-crawler settings there (enforcement-layers.md §5)"
  while read -r did dname waf; do
    [ -z "${did:-}" ] && continue
    if [ -z "${waf:-}" ] || [ "$waf" = "None" ]; then
      finding MED "CloudFront \`$did\` ($dname) has no WAF web ACL attached"
    else
      ok "CloudFront \`$did\` has a WAF web ACL — confirm no managed rule group blocks AI crawlers (aws-hardening.md, interaction table)"
    fi
  done <<< "$RUN_OUT"
fi

if run 'elbv2 describe-load-balancers' elbv2 describe-load-balancers --query 'LoadBalancers[].[LoadBalancerArn,LoadBalancerName]'; then
  load_balancers="$RUN_OUT"
  while read -r arn name; do
    [ -z "${arn:-}" ] && continue
    if run "elbv2 describe-listeners for $name" elbv2 describe-listeners --load-balancer-arn "$arn" --query 'Listeners[].Protocol'; then
      printf '%s' "$RUN_OUT" | grep -qw HTTP && note "ALB \`$name\` has an HTTP listener — confirm it only redirects to HTTPS"
    fi
    if run "elbv2 describe-load-balancer-attributes for $name" elbv2 describe-load-balancer-attributes --load-balancer-arn "$arn" --query 'Attributes[?Key==`access_logs.s3.enabled`].Value'; then
      [ "${RUN_OUT:-false}" != "true" ] && finding LOW "ALB \`$name\` has access logs disabled"
    fi
  done <<< "$load_balancers"
fi

if run 'wafv2 list-web-acls (regional)' wafv2 list-web-acls --scope REGIONAL --query 'WebACLs[].Name'; then
  note "regional WAF web ACLs: $(count "$RUN_OUT")"
fi

# ---------------------------------------------------------------- logging
head2 "7. Logging, detection, cost"

if run 'cloudtrail describe-trails' cloudtrail describe-trails --query 'trailList[].[Name,IsMultiRegionTrail,LogFileValidationEnabled]'; then
  if [ -z "$RUN_OUT" ]; then
    finding HIGH "no CloudTrail trail configured — there is no audit log of API activity"
  else
    trails="$RUN_OUT"
    while read -r tname multi validation; do
      [ -z "${tname:-}" ] && continue
      [ "$multi" != "True" ] && finding MED "CloudTrail \`$tname\` is not multi-region"
      [ "$validation" != "True" ] && finding LOW "CloudTrail \`$tname\` has log file validation disabled"
      if run "cloudtrail get-trail-status for $tname" cloudtrail get-trail-status --name "$tname" --query 'IsLogging'; then
        if [ "$RUN_OUT" = "True" ]; then
          ok "CloudTrail \`$tname\` is logging"
        else
          finding HIGH "CloudTrail \`$tname\` is **not currently logging**"
        fi
      fi
    done <<< "$trails"
  fi
fi

if run 'guardduty list-detectors' guardduty list-detectors --query 'DetectorIds'; then
  [ "$(count "$RUN_OUT")" = "0" ] && finding MED "GuardDuty is not enabled in $REGION" || ok "GuardDuty enabled"
fi

if run 'configservice describe-configuration-recorders' configservice describe-configuration-recorders --query 'ConfigurationRecorders[].name'; then
  [ "$(count "$RUN_OUT")" = "0" ] && finding LOW "AWS Config is not recording in $REGION" || ok "AWS Config recording"
fi

if run 'budgets describe-budgets' budgets describe-budgets --account-id "$ACCOUNT" --query 'Budgets[].BudgetName'; then
  n=$(count "$RUN_OUT")
  [ "$n" = "0" ] \
    && finding MED "no AWS Budgets configured — for an AI/LLM product, spend is the earliest reliable abuse alarm" \
    || ok "budgets configured: $n"
fi

if run 'secretsmanager list-secrets' secretsmanager list-secrets --query 'SecretList[].Name'; then
  note "Secrets Manager secrets: $(count "$RUN_OUT") — confirm the app reads secrets from here or SSM SecureString, not from a file on the instance"
fi

# ---------------------------------------------------------------- summary
head2 "Summary"
say "- HIGH: $HIGH · MEDIUM: $MED · LOW: $LOW · UNCHECKED: $UNCHECKED"
say ""
say "UNCHECKED items are unknown, not passing. Re-run with a principal holding \`SecurityAudit\` or \`ReadOnlyAccess\` to close them."
say ""
say "This script covers one region. Re-run for every region in use — unused regions are where crypto-mining and forgotten resources show up."
say ""
say "Before changing any WAF, CloudFront, or security-group rule that touches public traffic, re-run \`crawl-surface-audit.mjs\` and diff the crawler UA matrix. Those changes are also SEO changes."

if [ -n "$OUT_DIR" ]; then
  mkdir -p "$OUT_DIR"
  f="$OUT_DIR/aws-exposure-$ACCOUNT-$REGION-$(date -u +%Y%m%dT%H%M%SZ).md"
  printf '%s' "$REPORT" > "$f"
  echo "wrote $f" >&2
fi

[ "$HIGH" -gt 0 ] && exit 1
[ "$UNCHECKED" -gt 0 ] && exit 3
exit 0
