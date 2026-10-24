import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// Offline artwork export; the application loads only the resulting PNG.
// Uses a separate, temporary Chrome profile, never an existing browser session.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(project, 'src/rendering/vehicles/assets/bkm32100d-surface-atlas.png');
const candidates = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
let chrome;
for (const candidate of candidates) {
  try {
    await access(candidate);
    chrome = candidate;
    break;
  } catch {
    // Try the next standard installation path.
  }
}
if (!chrome) throw new Error('Set CHROME_BIN to a local Chrome or Chromium executable.');

const temporary = await mkdtemp(path.join(tmpdir(), 'trolleybus-atlas-'));
try {
  const bundle = await build({
    entryPoints: [path.join(project, 'scripts/vehicle-atlas-painter.ts')],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'VehicleAtlasArtwork',
    platform: 'browser',
    target: 'chrome120',
  });
  const html = path.join(temporary, 'atlas.html');
  await writeFile(
    html,
    `<!doctype html><html><head><meta charset="UTF-8"><style>
      html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent}
      canvas{display:block;width:1024px;height:1024px}
    </style></head><body><script>${bundle.outputFiles[0].text}
      document.body.append(VehicleAtlasArtwork.createVehicleAtlasCanvas());
    </script></body></html>`,
  );
  await mkdir(path.dirname(output), { recursive: true });
  await new Promise((resolve, reject) => {
    const child = spawn(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${path.join(temporary, 'chrome-profile')}`,
        `--screenshot=${output}`,
        '--window-size=1024,1024',
        '--force-device-scale-factor=1',
        '--default-background-color=00000000',
        '--hide-scrollbars',
        '--virtual-time-budget=1000',
        pathToFileURL(html).href,
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let diagnostics = '';
    child.stderr.on('data', (data) => {
      diagnostics = (diagnostics + data).slice(-4000);
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Atlas export failed (${code}): ${diagnostics}`));
    });
  });
  const png = await readFile(output);
  if (png.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('Expected a PNG atlas.');
  if (png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024)
    throw new Error('Expected a 1024 × 1024 atlas.');
  console.log(`Exported ${path.relative(project, output)} (${Math.round(png.length / 1024)} KiB).`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
