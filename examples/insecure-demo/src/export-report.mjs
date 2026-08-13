import { exec } from 'node:child_process';

export function exportReport(title) {
  return new Promise((resolve, reject) => {
    exec(`printf '%s\\n' "${title}"`, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}
