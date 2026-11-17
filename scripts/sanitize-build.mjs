import { readdir, unlink, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve('.next/standalone');
let removed = 0;
for (const name of await readdir(root)) {
  if (!name.startsWith('.env')) continue;
  const file = resolve(root, name);
  if ((await lstat(file)).isFile()) {
    await unlink(file);
    removed++;
  }
}
console.log(
  `Standalone build sanitised: ${removed} copied environment file(s) removed. Runtime secrets must be injected.`,
);
