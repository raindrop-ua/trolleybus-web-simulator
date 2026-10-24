import { access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [
  process.env.BLENDER_BIN,
  '/Applications/Blender.app/Contents/MacOS/Blender',
  '/usr/bin/blender',
].filter(Boolean);
let blender;
for (const candidate of candidates) {
  try {
    await access(candidate);
    blender = candidate;
    break;
  } catch {
    /* Try next installation. */
  }
}
if (!blender) throw new Error('Set BLENDER_BIN to the Blender executable.');
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} exited ${code}`)),
    );
  });
}
const args = process.argv.slice(2);
const fromBlend = args.includes('--from-blend');
await run(blender, [
  '--background',
  ...(fromBlend ? ['assets/vehicles/bkm32100d/source/bkm32100d.blend'] : ['--factory-startup']),
  '--python',
  `scripts/blender/${fromBlend ? 'export_trolleybus' : 'generate_trolleybus'}.py`,
  '--',
  ...args.filter((arg) => arg !== '--from-blend'),
]);
await run(process.execPath, ['scripts/optimize-vehicle.mjs']);
