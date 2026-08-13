#!/usr/bin/env bash
set -u

args=" $* "
mode="${AWS_FIXTURE_MODE:-nested-denial}"
deny() {
  printf '%s\n' "An error occurred (AccessDenied): ${AWS_SECRET_ACCESS_KEY:-fixture-secret-missing}" >&2
  exit 254
}

if [ "$mode" = "top-denial" ] && printf '%s' "$args" | grep -q ' sts get-caller-identity '; then
  deny
fi
if [ "$mode" = "nested-denial" ] || [ "$mode" = "mixed-high-unknown" ]; then
  case "$args" in
    *" iam list-mfa-devices "*|*" cloudtrail get-trail-status "*) deny ;;
  esac
fi
if [ "$mode" = "malformed" ] && printf '%s' "$args" | grep -q ' iam get-account-summary '; then
  printf '%s\n' '{not-json'
  exit 0
fi

case "$args" in
  *" sts get-caller-identity "*) printf '%s\n' '["123456789012","arn:aws:iam::123456789012:role/security-audit"]' ;;
  *" iam get-account-summary "*)
    if [ "$mode" = "mixed-high-unknown" ]; then printf '%s\n' '[0,0,1]'; else printf '%s\n' '[1,0,1]'; fi ;;
  *" iam list-users "*) printf '%s\n' '["fixture-user"]' ;;
  *" iam list-access-keys "*|*" iam list-policies "*) printf '%s\n' '[]' ;;
  *" iam get-account-password-policy "*) printf '%s\n' '{}' ;;
  *" ec2 describe-security-groups "*)
    if [ "$mode" = "duplicate-sg" ]; then
      case "$args" in
        *" --group-ids "*) printf '%s\n' '[["tcp",22,22],["tcp",22,22]]' ;;
        *) printf '%s\n' '[["sg-fixture","fixture-group"]]' ;;
      esac
    else
      printf '%s\n' '[]'
    fi ;;
  *" ec2 describe-flow-logs "*|*" ec2 describe-instances "*) printf '%s\n' '[]' ;;
  *" ec2 get-ebs-encryption-by-default "*) printf '%s\n' 'true' ;;
  *" ec2 describe-snapshots "*|*" ec2 describe-images "*) printf '%s\n' '0' ;;
  *" s3control get-public-access-block "*) printf '%s\n' '[true,true,true,true]' ;;
  *" s3api list-buckets "*|*" rds describe-db-instances "*|*" docdb describe-db-clusters "*) printf '%s\n' '[]' ;;
  *" cloudfront list-distributions "*|*" elbv2 describe-load-balancers "*) printf '%s\n' '[]' ;;
  *" cloudtrail describe-trails "*) printf '%s\n' '[["fixture-trail",true,true]]' ;;
  *" guardduty list-detectors "*|*" configservice describe-configuration-recorders "*|*" budgets describe-budgets "*) printf '%s\n' '[]' ;;
  *) printf '%s\n' '[]' ;;
esac
