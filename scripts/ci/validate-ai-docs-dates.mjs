#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const DOCS_TO_VALIDATE = [
  'docs/ai/MEMORY.md',
  'docs/ai/BACKLOG.md',
];

const DEFAULT_MAX_AGE_DAYS = 14;
const rawMaxAgeDays = process.env.AI_DOCS_MAX_AGE_DAYS;
const maxAgeDays = rawMaxAgeDays === undefined ? DEFAULT_MAX_AGE_DAYS : Number(rawMaxAgeDays);

if (!Number.isFinite(maxAgeDays) || maxAgeDays < 0 || !Number.isInteger(maxAgeDays)) {
  console.error(
    [
      'AI docs date validation failed.',
      `Invalid AI_DOCS_MAX_AGE_DAYS value: "${rawMaxAgeDays}".`,
      'Set AI_DOCS_MAX_AGE_DAYS to a non-negative integer (for example: 14).',
    ].join('\n'),
  );
  process.exit(1);
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const now = new Date();
const staleAfter = new Date(now.getTime() - maxAgeDays * MS_PER_DAY);

/** @type {string[]} */
const errors = [];

for (const filePath of DOCS_TO_VALIDATE) {
  let content;
  try {
    content = readFileSync(filePath, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(
      [
        `${filePath}: unable to read file (${message}).`,
        `Action: ensure ${filePath} exists and is committed.`,
      ].join('\n'),
    );
    continue;
  }

  const match = content.match(/^Last reviewed:\s*(.+)\s*$/m);
  if (!match) {
    errors.push(
      [
        `${filePath}: missing required "Last reviewed: YYYY-MM-DD" line.`,
        `Action: add a top-level line exactly like "Last reviewed: ${formatDateUTC(now)}".`,
      ].join('\n'),
    );
    continue;
  }

  const candidateDate = match[1].trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidateDate)) {
    errors.push(
      [
        `${filePath}: invalid date format in "Last reviewed" (${candidateDate}).`,
        'Action: use the ISO format YYYY-MM-DD (example: 2026-04-14).',
      ].join('\n'),
    );
    continue;
  }

  const parsedDate = new Date(`${candidateDate}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || formatDateUTC(parsedDate) !== candidateDate) {
    errors.push(
      [
        `${filePath}: "Last reviewed" date is not a real calendar date (${candidateDate}).`,
        'Action: replace it with a valid date such as 2026-04-14.',
      ].join('\n'),
    );
    continue;
  }

  if (parsedDate > now) {
    errors.push(
      [
        `${filePath}: "Last reviewed" cannot be in the future (${candidateDate}).`,
        `Action: set it to today or earlier (today: ${formatDateUTC(now)}).`,
      ].join('\n'),
    );
    continue;
  }

  if (parsedDate < staleAfter) {
    const ageDays = Math.floor((now.getTime() - parsedDate.getTime()) / MS_PER_DAY);
    errors.push(
      [
        `${filePath}: "Last reviewed" is stale (${candidateDate}, ${ageDays} days old).`,
        `Action: update the document and set "Last reviewed" to today (${formatDateUTC(now)}) or within the last ${maxAgeDays} days.`,
      ].join('\n'),
    );
  }
}

if (errors.length > 0) {
  console.error('AI docs date validation failed:\n');
  for (const [index, error] of errors.entries()) {
    console.error(`${index + 1}. ${error}`);
    if (index < errors.length - 1) {
      console.error('');
    }
  }
  process.exit(1);
}

console.log(
  `AI docs date validation passed for ${DOCS_TO_VALIDATE.length} files (max age ${maxAgeDays} days).`,
);

function formatDateUTC(date) {
  return date.toISOString().slice(0, 10);
}
