import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'assets/vehicles/bkm32100d/textures');
await mkdir(output, { recursive: true });
const source = pathToFileURL(path.join(output, 'generated-surfaces-source.png')).href;
const colors = { blue: '#138bc8', white: '#eff4ec', violet: '#4f529b' };
function wave(y, amplitude, period, width) {
  let d = '';
  for (let x = 0; x <= width; x += 2)
    d += `${x === 0 ? 'M' : 'L'}${x},${y + Math.sin((x / period) * Math.PI * 2) * amplitude}`;
  return d;
}
const shield = (x, y, scale = 1, aspect = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale} ${scale * aspect})" fill="none" stroke="${colors.white}" stroke-width="5"><path d="M0 0 Q25 -8 50 0 L46 27 Q25 48 4 27Z"/><path d="M10 7 Q23 1 39 8 L30 18 13 13"/></g>`;
const symbols = (x, y, scale = 1, aspect = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale} ${scale * aspect})"><g fill="#305b97" stroke="#ecf3e8" stroke-width="2"><circle cx="0" cy="0" r="19"/><circle cx="48" cy="0" r="19"/><circle cx="96" cy="0" r="19"/></g><g fill="none" stroke="#ecf3e8" stroke-width="3" stroke-linecap="round"><circle cx="0" cy="-9" r="3" fill="#ecf3e8"/><path d="M0 -4V6 M-9 0L0 -4 8 1 M0 6L-6 14 M0 6L6 14"/><circle cx="48" cy="-9" r="3" fill="#ecf3e8"/><path d="M48 -3V6H59L64 14 M48 1H57 M43 2a10 10 0 1 0 12 12"/><path d="M89 -10V12H104 M92 -10h7v10h-7 M97 2l8 8"/></g></g>`;
const side = (y, driver) => {
  const xFromZ = (z) => ((driver ? 6 - z : z + 6) / 12) * 2048;
  return `<g transform="translate(0 ${y})"><rect width="2048" height="512" fill="${colors.blue}"/><rect width="2048" height="512" fill="url(#grain)" opacity=".10"/>
    <g fill="${colors.violet}" opacity=".76"><path d="M${xFromZ(-3.9)} 0L${xFromZ(-3.2)} 0L${xFromZ(-4.0)} 450L${xFromZ(-4.7)} 450Z"/><path d="M${xFromZ(-2.7)} 0L${xFromZ(-2.1)} 0L${xFromZ(-2.9)} 450L${xFromZ(-3.5)} 450Z"/></g>
    <path d="${wave(474, 11, 220, 2048)}" fill="none" stroke="${colors.white}" stroke-width="13"/>
    ${shield(xFromZ(1.6), 358, 0.48)}<text x="${xFromZ(1.6) + 32}" y="379" font-size="27" font-family="Arial" fill="${colors.white}">Дніпро</text>
    <text x="${xFromZ(-0.8)}" y="371" font-size="12" font-family="Arial" fill="${colors.white}">МУНІЦИПАЛЬНИЙ</text><text x="${xFromZ(-0.8)}" y="386" font-size="12" font-family="Arial" fill="${colors.white}">ЕЛЕКТРОТРАНСПОРТ</text>
    </g>`;
};
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048"><defs><pattern id="grain" width="256" height="256" patternUnits="userSpaceOnUse"><svg width="256" height="256" viewBox="0 0 1024 1024" overflow="hidden"><image href="${source}" width="2048" height="2048"/></svg></pattern><pattern id="led" width="6" height="6" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#172b2d"/></pattern></defs>
  <rect width="2048" height="2048" fill="${colors.blue}"/>${side(0, false)}${side(512, true)}
  <g transform="translate(0 1024)"><rect width="1024" height="512" fill="${colors.blue}"/><rect width="1024" height="512" fill="url(#grain)" opacity=".10"/>${symbols(190, 240, 1.2)}
    <g transform="translate(470 250)" fill="#b4c4c6"><path d="M-45 -20L0 0 45 -20V-3L0 18 -45 -3Z"/><path d="M-35 1L0 18 35 1V16L0 34 -35 16Z"/></g>
  </g><g transform="translate(1024 1024)"><rect width="1024" height="512" fill="${colors.blue}"/>${shield(150, 276, 1.0, 0.52)}<text transform="translate(220 305) scale(1 .52)" fill="${colors.white}" font-size="48" font-family="Arial">Дніпро</text>${symbols(655, 452, 1.1, 0.52)}
    <path d="M480 190L510 242H450Z" fill="#e9c258"/><path d="M483 203L471 221H483L476 234" stroke="#333" fill="none" stroke-width="4"/>
  </g>
  <g transform="translate(0 1536)"><rect width="1024" height="256" fill="#111d22"/><rect width="1024" height="256" fill="url(#led)"/><g fill="#f2ad46" font-family="Arial" font-weight="bold"><text x="30" y="198" font-size="202">6</text><text x="185" y="98" font-size="48">Ж/М ПРИДНІПРОВСЬКИЙ</text><text x="185" y="179" font-size="61">ПЛОЩА СОБОРНА</text></g></g>
  <g transform="translate(1024 1536)"><rect width="512" height="256" fill="#111d22"/><text x="256" y="202" font-size="204" font-family="Arial" text-anchor="middle" fill="#f2ad46">6</text></g>
  <g transform="translate(1536 1536)"><rect width="512" height="512" fill="#1c282d"/><g stroke="#698087" stroke-width="2" opacity=".8">${Array.from({ length: 32 }, (_, i) => `<path d="M0 ${i * 16}H512"/>`).join('')}</g></g>
</svg>`;
const number = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128"><text x="128" y="92" text-anchor="middle" font-family="Arial" font-size="87" fill="#f0f4ed">2004</text></svg>`;
const candidates = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
let chrome;
for (const candidate of candidates) {
  try {
    await access(candidate);
    chrome = candidate;
    break;
  } catch {
    /* Try next location. */
  }
}
if (!chrome) throw new Error('Set CHROME_BIN to Chrome/Chromium.');
const temporary = await mkdtemp(path.join(tmpdir(), 'trolleybus-textures-'));
try {
  for (const [name, image, width, height] of [
    ['livery-basecolor', svg, 2048, 2048],
    ['fleet-number-2004', number, 256, 128],
  ]) {
    await writeFile(path.join(output, `${name}.svg`), image);
    const html = path.join(output, `${name}.html`);
    await writeFile(
      html,
      `<html><style>html,body{margin:0;padding:0;width:${width}px;height:${height}px;background:transparent;overflow:hidden}svg{display:block}</style>${image}</html>`,
    );
    await new Promise((resolve, reject) => {
      const child = spawn(
        chrome,
        [
          '--headless=new',
          '--disable-gpu',
          '--allow-file-access-from-files',
          '--no-first-run',
          '--no-default-browser-check',
          `--user-data-dir=${path.join(temporary, name)}`,
          `--screenshot=${path.join(output, name + '.png')}`,
          `--window-size=${width},${height}`,
          '--force-device-scale-factor=1',
          '--default-background-color=00000000',
          '--hide-scrollbars',
          '--virtual-time-budget=1500',
          pathToFileURL(html).href,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let diagnostics = '';
      child.stderr.on('data', (data) => {
        diagnostics = (diagnostics + data).slice(-1500);
      });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(diagnostics))));
    });
    await rm(html);
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.log('Vehicle PNG livery and fleet label generated. Material source retained separately.');
