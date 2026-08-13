#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function scalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function printable(value) {
  if (!scalar(value)) throw new Error('value is not scalar');
  const rendered = value === null ? 'None' : String(value);
  if (/\r|\n|\t/.test(rendered)) throw new Error('scalar contains unsupported whitespace');
  return rendered;
}

function collectRows(value, width, rows = []) {
  if (!Array.isArray(value)) throw new Error('rows input must be an array');
  if (value.length === width && value.every(scalar)) {
    rows.push(value);
    return rows;
  }
  for (const item of value) collectRows(item, width, rows);
  return rows;
}

try {
  const [mode, widthText] = process.argv.slice(2);
  const input = readFileSync(0, 'utf8');
  if (mode === 'hash') {
    if (!widthText || /[^a-z0-9-]/.test(widthText)) throw new Error('hash label is invalid');
    process.stdout.write(`${widthText}-${createHash('sha256').update(input).digest('hex').slice(0, 16)}\n`);
    process.exit(0);
  }
  const value = JSON.parse(input);
  if (mode === 'validate') process.exit(0);
  if (mode === 'scalar') {
    process.stdout.write(`${printable(value)}\n`);
  } else if (mode === 'tuple') {
    const width = Number(widthText);
    if (!Number.isInteger(width) || width < 1 || !Array.isArray(value)
        || value.length !== width || !value.every(scalar)) throw new Error('tuple shape mismatch');
    process.stdout.write(`${value.map(printable).join('\t')}\n`);
  } else if (mode === 'list') {
    if (!Array.isArray(value) || !value.every(scalar)) throw new Error('list shape mismatch');
    process.stdout.write(value.map(printable).join('\n'));
    if (value.length) process.stdout.write('\n');
  } else if (mode === 'rows') {
    const width = Number(widthText);
    if (!Number.isInteger(width) || width < 1) throw new Error('row width is invalid');
    const rows = collectRows(value, width);
    process.stdout.write(rows.map((row) => row.map(printable).join('\t')).join('\n'));
    if (rows.length) process.stdout.write('\n');
  } else if (mode === 'policy-wildcard') {
    const statements = Array.isArray(value?.Statement) ? value.Statement : value?.Statement ? [value.Statement] : [];
    const wildcard = statements.some((statement) => {
      const actions = Array.isArray(statement?.Action) ? statement.Action : [statement?.Action];
      const resources = Array.isArray(statement?.Resource) ? statement.Resource : [statement?.Resource];
      return statement?.Effect !== 'Deny' && actions.includes('*') && resources.includes('*');
    });
    process.stdout.write(`${wildcard}\n`);
  } else {
    throw new Error('unknown JSON query mode');
  }
} catch (error) {
  console.error(`invalid AWS JSON: ${error.message}`);
  process.exit(1);
}
