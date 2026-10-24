import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
const violations = [];
async function check(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (/\.tsx?$/.test(file)) {
      const contents = await readFile(file, 'utf8');
      for (const match of contents.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
        const dependency = match[1];
        if (
          /^src\/(core|domain|simulation)\//.test(file) &&
          /react|three|zustand|rendering|\/ui\//.test(dependency)
        )
          violations.push(`${file}: ${dependency}`);
        if (/^src\/core\//.test(file) && /domain|simulation/.test(dependency))
          violations.push(`${file}: ${dependency}`);
      }
    }
  }
}
await check('src');
if (violations.length) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else console.log('Architecture boundaries passed.');
