import fs from 'node:fs';
import path from 'node:path';

const manifestPath = process.argv[2] || 'test/flaky-manifest.json';
const outputDir = process.argv[3] || 'artifacts/flaky';
const logPaths = process.argv.slice(4);

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to parse JSON at ${filePath}: ${error.message}`);
  }
}

function validateManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    return ['Manifest root must be an object.'];
  }

  if (!Array.isArray(manifest.quarantinedTests)) {
    errors.push('Manifest must include a quarantinedTests array.');
    return errors;
  }

  for (const [index, entry] of manifest.quarantinedTests.entries()) {
    const prefix = `quarantinedTests[${index}]`;

    if (!entry || typeof entry !== 'object') {
      errors.push(`${prefix} must be an object.`);
      continue;
    }

    if (!entry.id || typeof entry.id !== 'string') {
      errors.push(`${prefix}.id is required.`);
    }

    if (!entry.testMatch || typeof entry.testMatch !== 'string') {
      errors.push(`${prefix}.testMatch is required.`);
    }

    if (!entry.owner || typeof entry.owner !== 'string') {
      errors.push(`${prefix}.owner is required.`);
    }

    if (!entry.ticket || typeof entry.ticket !== 'string') {
      errors.push(`${prefix}.ticket is required.`);
    }

    if (!entry.expiry || typeof entry.expiry !== 'string' || !isIsoDate(entry.expiry)) {
      errors.push(`${prefix}.expiry is required and must be YYYY-MM-DD.`);
    }
  }

  return errors;
}

function readLogs(paths) {
  return paths
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({ filePath, content: fs.readFileSync(filePath, 'utf8') }));
}

function buildReport(manifest, logs) {
  const occurrences = [];

  for (const entry of manifest.quarantinedTests) {
    let count = 0;
    const files = [];

    for (const log of logs) {
      const lines = log.content.split('\n');
      let fileCount = 0;

      for (const line of lines) {
        if (line.includes(entry.testMatch)) {
          count += 1;
          fileCount += 1;
        }
      }

      if (fileCount > 0) {
        files.push({
          path: log.filePath,
          matches: fileCount
        });
      }
    }

    occurrences.push({
      id: entry.id,
      owner: entry.owner,
      ticket: entry.ticket,
      expiry: entry.expiry,
      testMatch: entry.testMatch,
      hits: count,
      files
    });
  }

  const totalHits = occurrences.reduce((sum, item) => sum + item.hits, 0);

  return {
    generatedAt: new Date().toISOString(),
    manifestPath,
    scannedLogs: logs.map((log) => log.filePath),
    quarantinedTestCount: manifest.quarantinedTests.length,
    totalHits,
    occurrences
  };
}

function buildMarkdown(report) {
  const lines = [
    '# Flaky quarantine summary',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Manifest: ${report.manifestPath}`,
    `- Quarantined tests tracked: ${report.quarantinedTestCount}`,
    `- Total quarantined hits this run: ${report.totalHits}`,
    ''
  ];

  if (report.occurrences.length === 0) {
    lines.push('No quarantined tests are currently listed in the manifest.');
    return `${lines.join('\n')}\n`;
  }

  lines.push('| ID | Test matcher | Hits | Owner | Ticket | Expiry |');
  lines.push('| --- | --- | ---: | --- | --- | --- |');

  for (const item of report.occurrences) {
    lines.push(`| ${item.id} | \`${item.testMatch}\` | ${item.hits} | ${item.owner} | ${item.ticket} | ${item.expiry} |`);
  }

  lines.push('');
  lines.push('## Hit details');

  for (const item of report.occurrences) {
    if (item.hits === 0) {
      continue;
    }

    lines.push(`- **${item.id}** hit ${item.hits} time(s):`);
    for (const file of item.files) {
      lines.push(`  - ${file.path}: ${file.matches}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

const manifest = readJson(manifestPath);
const validationErrors = validateManifest(manifest);

if (validationErrors.length > 0) {
  for (const error of validationErrors) {
    console.error(`::error::${error}`);
  }
  process.exit(1);
}

const logs = readLogs(logPaths);
const report = buildReport(manifest, logs);

fs.mkdirSync(outputDir, { recursive: true });

const jsonOutputPath = path.join(outputDir, 'flaky-summary.json');
const markdownOutputPath = path.join(outputDir, 'flaky-summary.md');

fs.writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(markdownOutputPath, buildMarkdown(report));

for (const item of report.occurrences) {
  if (item.hits > 0) {
    console.log(`::warning::Quarantined test '${item.id}' matched ${item.hits} log line(s). Owner: ${item.owner}. Ticket: ${item.ticket}.`);
  }
}

console.log(`Generated flaky quarantine reports at ${jsonOutputPath} and ${markdownOutputPath}`);
