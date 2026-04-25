import fs from 'node:fs/promises';
import path from 'node:path';

const API_DIR = path.resolve('api');

const collectTsFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectTsFiles(fullPath);
      }
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        return [fullPath];
      }
      return [];
    })
  );
  return files.flat();
};

const importPattern = /from\s+['"](\.{1,2}\/[^'"]+)['"]/g;
const hasJsExtension = (specifier) => specifier.endsWith('.js');

const main = async () => {
  const tsFiles = await collectTsFiles(API_DIR);
  const failures = [];

  for (const file of tsFiles) {
    const content = await fs.readFile(file, 'utf8');
    let match;
    while ((match = importPattern.exec(content)) !== null) {
      const specifier = match[1];
      if (!hasJsExtension(specifier)) {
        failures.push(`${path.relative(process.cwd(), file)} -> ${specifier}`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('Found serverless runtime imports without emitted ".js" extension:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Verified ${tsFiles.length} serverless TypeScript files with explicit runtime ".js" import extensions.`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
