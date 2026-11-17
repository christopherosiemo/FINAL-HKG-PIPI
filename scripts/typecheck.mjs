import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
for (const [file, args] of [
  [require.resolve('next/dist/bin/next'), ['typegen']],
  [require.resolve('typescript/bin/tsc'), ['--noEmit']],
]) {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file, ...args], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) process.exit(Number(code) || 1);
}
