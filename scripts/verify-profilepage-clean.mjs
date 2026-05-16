import { readFileSync } from 'node:fs';

const path = 'src/pages/ProfilePage.tsx';
const source = readFileSync(path, 'utf8');

const forbiddenPatterns = [
  { pattern: /<<<<<<<|=======|>>>>>>>/, message: 'merge conflict markers' },
  { pattern: /normalizedLink:\s*link/, message: 'stale social debug object block' },
  { pattern: /profileId:\s*profile\.id/, message: 'stale social debug object block' }
];

for (const { pattern, message } of forbiddenPatterns) {
  if (pattern.test(source)) {
    console.error(`[verify-profilepage-clean] Found ${message} in ${path}.`);
    process.exit(1);
  }
}

console.log('[verify-profilepage-clean] OK');
