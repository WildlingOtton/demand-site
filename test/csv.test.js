'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('csv-parse/sync');

// Replicate the escapeField helper from the demands route for unit testing
function escapeField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Build a CSV row from an array of values (mirrors demands route logic)
function buildCsvRow(values) {
  return values.map(escapeField).join(',');
}

test('escapeField - plain string is returned as-is', () => {
  assert.equal(escapeField('Engineering'), 'Engineering');
});

test('escapeField - null/undefined returns empty string', () => {
  assert.equal(escapeField(null), '');
  assert.equal(escapeField(undefined), '');
});

test('escapeField - string with comma is quoted', () => {
  assert.equal(escapeField('Sales, Marketing'), '"Sales, Marketing"');
});

test('escapeField - string with double-quote is escaped', () => {
  assert.equal(escapeField('Say "hello"'), '"Say ""hello"""');
});

test('escapeField - string with newline is quoted', () => {
  assert.equal(escapeField('line1\nline2'), '"line1\nline2"');
});

test('escapeField - numbers are converted to string', () => {
  assert.equal(escapeField(42), '42');
  assert.equal(escapeField(0), '0');
});

test('CSV export row format', () => {
  const row = buildCsvRow(['1', 'Senior Engineer', 'Needs Python skills, SQL', 'Engineering', '3', 'open', 'alice', '2024-01-01T00:00:00.000Z']);
  assert.equal(row, '1,Senior Engineer,"Needs Python skills, SQL",Engineering,3,open,alice,2024-01-01T00:00:00.000Z');
});

test('CSV export header row', () => {
  const headers = ['id', 'title', 'description', 'department', 'numberOfPositions', 'status', 'createdBy', 'createdAt'];
  assert.equal(headers.join(','), 'id,title,description,department,numberOfPositions,status,createdBy,createdAt');
});

test('csv-parse: parse valid CSV with headers', () => {
  const csv = 'title,description,department,numberOfPositions,status\nSenior Dev,Backend role,Engineering,2,open\n';
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  assert.equal(records.length, 1);
  assert.equal(records[0].title, 'Senior Dev');
  assert.equal(records[0].description, 'Backend role');
  assert.equal(records[0].department, 'Engineering');
  assert.equal(records[0].numberOfPositions, '2');
  assert.equal(records[0].status, 'open');
});

test('csv-parse: parse multiple rows', () => {
  const csv = 'title,department\nDev,Eng\nDesigner,Product\n';
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  assert.equal(records.length, 2);
  assert.equal(records[0].title, 'Dev');
  assert.equal(records[1].title, 'Designer');
});

test('csv-parse: trims whitespace from fields', () => {
  const csv = 'title , department\n  Senior Dev , Engineering \n';
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  assert.equal(records[0].title, 'Senior Dev');
  assert.equal(records[0].department, 'Engineering');
});

test('csv-parse: handles quoted fields with commas', () => {
  const csv = 'title,description\n"Engineer","Needs Python, SQL, and Go"\n';
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  assert.equal(records[0].description, 'Needs Python, SQL, and Go');
});

test('csv-parse: skips empty lines', () => {
  const csv = 'title,department\nDev,Eng\n\n\nDesigner,Product\n';
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  assert.equal(records.length, 2);
});

test('import: status defaults to open when invalid', () => {
  const STATUS = { OPEN: 'open', IN_PROGRESS: 'in_progress', FILLED: 'filled', CANCELLED: 'cancelled' };
  const validStatuses = Object.values(STATUS);
  const resolveStatus = (status) => (validStatuses.includes(status) ? status : STATUS.OPEN);

  assert.equal(resolveStatus('open'), 'open');
  assert.equal(resolveStatus('in_progress'), 'in_progress');
  assert.equal(resolveStatus('invalid'), 'open');
  assert.equal(resolveStatus(''), 'open');
  assert.equal(resolveStatus(undefined), 'open');
});

test('import: numberOfPositions defaults to 1 when invalid', () => {
  const resolvePositions = (numberOfPositions) => {
    const parsed = parseInt(numberOfPositions, 10);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  };

  assert.equal(resolvePositions('3'), 3);
  assert.equal(resolvePositions('1'), 1);
  assert.equal(resolvePositions('0'), 1);
  assert.equal(resolvePositions('-1'), 1);
  assert.equal(resolvePositions('abc'), 1);
  assert.equal(resolvePositions(''), 1);
  assert.equal(resolvePositions(undefined), 1);
});
