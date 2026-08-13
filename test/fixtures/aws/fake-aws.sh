#!/usr/bin/env bash
set -u

args=" $* "
deny() {
  printf '%s\n' 'An error occurred (AccessDenied) when calling the fixture operation: not authorized' >&2
  exit 254
}

case "$args" in
  *" iam list-mfa-devices "*|*" cloudtrail get-trail-status "*) deny ;;
  *" sts get-caller-identity "*) printf '%s\n' '123456789012 arn:aws:iam::123456789012:role/security-audit' ;;
  *" iam get-account-summary "*) printf '%s\n' '1 0 1' ;;
  *" iam list-users "*) printf '%s\n' 'fixture-user' ;;
  *" iam list-access-keys "*) printf '%s\n' 'None' ;;
  *" iam list-policies "*) printf '%s\n' 'None' ;;
  *" iam get-account-password-policy "*) printf '%s\n' 'configured' ;;
  *" ec2 get-ebs-encryption-by-default "*) printf '%s\n' 'True' ;;
  *" ec2 describe-snapshots "*|*" ec2 describe-images "*) printf '%s\n' '0' ;;
  *" s3control get-public-access-block "*) printf '%s\n' 'True True True True' ;;
  *" cloudtrail describe-trails "*) printf '%s\n' 'fixture-trail True True' ;;
  *) printf '%s\n' 'None' ;;
esac
