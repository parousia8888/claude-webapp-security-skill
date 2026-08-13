import assert from 'node:assert/strict';
import { exportReport } from './src/export-report.mjs';

assert.equal(await exportReport('quarterly report'), 'quarterly report\n');
console.log('functional retest passed: ordinary report export still works');
