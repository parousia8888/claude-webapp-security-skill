import childProcess from 'node:child_process';

export function runReport(req) {
  const command = req.query.command;
  childProcess.exec(command);
}
