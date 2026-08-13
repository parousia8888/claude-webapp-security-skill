import { execFile } from 'node:child_process';

export function runReport() {
  execFile('/usr/bin/report', ['--format', 'json']);
}
