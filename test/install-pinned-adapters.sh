#!/usr/bin/env bash
set -euo pipefail

: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_ENV:?GITHUB_ENV is required}"

adapter_dir="$RUNNER_TEMP/webapp-security-adapters"
mkdir -p "$adapter_dir"

checkov_archive="$adapter_dir/checkov.zip"
curl -fsSL "https://github.com/bridgecrewio/checkov/releases/download/3.3.9/checkov_linux_X86_64.zip" -o "$checkov_archive"
echo "af7ccf93184fa09b5633dfd68fba78058717e6f80b31a44a3f2ef2eebd716f34  $checkov_archive" | sha256sum -c -
unzip -q "$checkov_archive" -d "$adapter_dir/checkov-dist"
checkov_binary="$adapter_dir/checkov-dist/dist/checkov"

gitleaks_archive="$adapter_dir/gitleaks.tar.gz"
curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz" -o "$gitleaks_archive"
echo "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  $gitleaks_archive" | sha256sum -c -
tar -xzf "$gitleaks_archive" -C "$adapter_dir" gitleaks

osv_binary="$adapter_dir/osv-scanner"
curl -fsSL "https://github.com/google/osv-scanner/releases/download/v2.5.0/osv-scanner_linux_amd64" -o "$osv_binary"
echo "edcfc41d257db36148f065055655fe3fcfc434b0b423ea67468a84c207524e0c  $osv_binary" | sha256sum -c -
chmod 0755 "$checkov_binary" "$adapter_dir/gitleaks" "$osv_binary"

opengrep_binary="$adapter_dir/opengrep"
curl -fsSL "https://github.com/opengrep/opengrep/releases/download/v1.27.0/opengrep_manylinux_x86" -o "$opengrep_binary"
echo "9d47d7de3f22ec5a93b25af9126648191e3d3b5d759dd4f699006138724719b3  $opengrep_binary" | sha256sum -c -
chmod 0755 "$opengrep_binary"

printf 'WEBAPP_SECURITY_CHECKOV_BIN=%s\n' "$checkov_binary" >> "$GITHUB_ENV"
printf 'WEBAPP_SECURITY_GITLEAKS_BIN=%s\n' "$adapter_dir/gitleaks" >> "$GITHUB_ENV"
printf 'WEBAPP_SECURITY_OPENGREP_BIN=%s\n' "$opengrep_binary" >> "$GITHUB_ENV"
printf 'WEBAPP_SECURITY_OSV_SCANNER_BIN=%s\n' "$osv_binary" >> "$GITHUB_ENV"
