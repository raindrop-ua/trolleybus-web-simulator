import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Layout-only reference/comparison sheets. Source photographs are never retouched.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const index = args.indexOf('--iteration');
const iteration = index >= 0 ? args[index + 1] : undefined;
if (!iteration || !/^[a-zA-Z0-9_-]+$/.test(iteration))
  throw new Error('Use --iteration 005 (an existing Blender preview iteration).');
const materials = args.includes('--materials');
const gate = materials ? 'Gates B–E' : 'Gate A';
const renderLabel = materials ? 'PBR' : 'Clay';
const output = path.join(
  root,
  'assets/vehicles/bkm32100d/review',
  materials ? 'gates-b-e' : 'gate-a',
);
await mkdir(output, { recursive: true });
const style = `
*{box-sizing:border-box}html,body{margin:0;background:#e8edf0;color:#1d2c36;font-family:Arial,sans-serif}
body{width:1800px;padding:44px 48px}header{display:flex;justify-content:space-between;align-items:end;margin-bottom:26px}
h1{font-size:34px;margin:8px 0}h2{font-size:20px;margin:0 0 8px}.eyebrow{font-size:13px;font-weight:bold;letter-spacing:2px;color:#537483}
p{font-size:16px;line-height:1.4;margin:5px 0}.tag{background:#d6e2e8;border-radius:20px;padding:10px 18px;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}.card{background:#fff;border:1px solid #cfdae0;border-radius:14px;overflow:hidden}
.card img{display:block;width:100%;height:250px;object-fit:contain;background:#dfe5e8}.caption{padding:15px 17px;min-height:108px}
.caption small{color:#647b87;font-size:12px}.caption p{font-size:14px}.foot{margin-top:22px;background:#d9e3e8;padding:18px 22px;border-radius:12px}
.rows{display:grid;gap:18px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:18px}.pair .card img,.pair svg{width:100%;height:275px;display:block;background:#d7dfe3;object-fit:contain}
.pair .caption{min-height:60px;padding:12px 18px}.pair .caption p{font-size:15px}.pair h2{font-size:18px}.note{font-size:13px;color:#5d707c}
`;
const header = (title, subtitle) =>
  `<header><div><div class="eyebrow">БКМ / АКСМ 32100D · 2004 · ${gate}</div><h1>${title}</h1><p>${subtitle}</p></div><div class="tag">Итерация ${iteration} · ${materials ? 'PNG + PBR' : 'без текстур'}</div></header>`;
const card = (image, title, text, file = image) =>
  `<article class="card"><img src="../../references/${image}"/><div class="caption"><h2>${title}</h2><p>${text}</p><small>${file}</small></div></article>`;
const html = (body) =>
  `<!doctype html><html lang="ru"><meta charset="utf-8"><style>${style}</style><body>${body}</body></html>`;
const board =
  header(
    'Карта референсов и опорных форм',
    'Настоящие фотографии задают форму. Сводные листы помогают читать силуэт, но содержат противоречия.',
  ) +
  `<section class="grid">` +
  [
    card(
      '00013495.jpg',
      '01 · Передний кожух и стекло',
      'Закрытый синий колпак, скруглённые верхние углы стекла, низкая чёрная V-маска.',
    ),
    card(
      '00024661.jpg',
      '02 · Пассажирская сторона',
      'Три пары дверей, низкий кузов, высокий объём крыши перед креплениями штанг.',
    ),
    card(
      '00097061.jpg',
      '03 · Масса задней части',
      'Закрытый отсек, закруглённые углы кормы, центральная лестница и барабаны.',
    ),
    card(
      '00098245.jpg',
      '04 · Фронтальные пропорции',
      'Ширина лобового стекла и форма козырька. Перспектива не даёт точного чертежа.',
    ),
    card(
      '00100179.jpg',
      '05 · Сторона водителя',
      'Непрерывное остекление без пассажирских дверей; ступенчатая форма крыши.',
    ),
    card(
      '00108977.jpg',
      '06 · Узнаваемость издали',
      'Общий силуэт, V-маска и форма закрытого кожуха читаются при мягком свете.',
    ),
    card(
      'design-sheet-1.png',
      '07 · Сводный лист — ориентир',
      'Полезен для общей компоновки. Двери на обеих сторонах и верхний вид противоречат фото.',
    ),
    card(
      'design-sheet-2.png',
      '08 · Сводный лист — ориентир',
      'Удобные ракурсы. Не переносим зеркальные двери и дублирующие крепления штанг.',
    ),
  ].join('') +
  `</section><footer class="foot"><p><strong>Опорная модель:</strong> длина ≈12 м, ширина ≈2,55 м; существующая база 6 м и колёса Ø0,98 м сохранены для совместимости с игрой.</p><p>Радиусы поверхностей и скрытая компоновка крыши — визуальная реконструкция. Точная заводская высота и внутреннее устройство батарейного оборудования по фото не определяются.</p></footer>`;
let cropIndex = 0;
const crop = (file, width, height, x, y, w, h, directory = 'references') => {
  const id = `crop-${cropIndex++}`;
  return `<svg viewBox="${x} ${y} ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs><image href="../../${directory}/${file}" width="${width}" height="${height}" clip-path="url(#${id})"/></svg>`;
};
const render = (file) => {
  if (file === 'front-three-quarter')
    return crop(`${file}.png`, 1500, 1000, 310, 340, 950, 470, `previews/${iteration}`);
  if (file === 'rear-three-quarter')
    return crop(`${file}.png`, 1500, 1000, 280, 300, 960, 500, `previews/${iteration}`);
  return `<img src="../../previews/${iteration}/${file}.png"/>`;
};
const comparisonPair = (reference, preview, leftTitle, rightTitle, note) =>
  `<section class="pair"><article class="card">${reference}<div class="caption"><h2>${leftTitle}</h2><p class="note">${note}</p></div></article><article class="card">${render(preview)}<div class="caption"><h2>${rightTitle}</h2><p class="note">${materials ? 'PNG-ливрея, мягкий студийный свет и отдельные материалы стекла, краски, резины и металла.' : 'Нейтральные материалы. Проверяем форму, а не окраску.'}</p></div></article></section>`;
const comparison =
  header(
    materials ? 'Фотография ↔ стилизованная модель' : 'Фотография ↔ геометрия',
    'Проверка пропорций и узнаваемых деталей. Кадры перспективные: это сравнение, а не измерительный чертёж.',
  ) +
  `<div class="rows">` +
  comparisonPair(
    crop('00100179.jpg', 1620, 1080, 610, 310, 770, 460),
    'front-three-quarter',
    'Фото · общий передний ракурс',
    `${renderLabel} · передний ракурс`,
    'Закрытый кожух, оконный пояс, свесы и переход к носовой части.',
  ) +
  comparisonPair(
    crop('00013495.jpg', 1240, 746, 280, 240, 350, 470),
    'front-detail',
    'Фото · лобовая часть',
    `${renderLabel} · лобовая часть`,
    'Панорамное стекло, скруглённый козырёк и чёрная V-образная маска.',
  ) +
  comparisonPair(
    crop('00097061.jpg', 1200, 800, 340, 245, 410, 420),
    'rear-three-quarter',
    'Фото · задняя часть',
    `${renderLabel} · задняя часть`,
    'Объём оборудования за последней дверью и закруглённая корма.',
  ) +
  comparisonPair(
    crop('design-sheet-2.png', 1536, 1024, 35, 20, 1150, 335),
    'side',
    'Сводный лист · пассажирская сторона',
    `${renderLabel} · пассажирская сторона`,
    'Проверка ритма дверей/окон, базы и профиля крыши. Фото имеют приоритет.',
  ) +
  `</div><footer class="foot"><p><strong>${gate}:</strong> ${materials ? 'детали и материалы в Blender, отдельные подвижные узлы, LOD1/2 для браузера. Штанги управляются решателем симуляции; провода не следуют за заездом к остановке.' : 'подготовлен к визуальной оценке. Детальные материалы и ливрея — последующие этапы.'}</p></footer>`;
await writeFile(path.join(output, 'reference-board.html'), html(board));
await writeFile(path.join(output, 'comparison.html'), html(comparison));

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
if (!chrome) throw new Error('HTML sheets created. Set CHROME_BIN to render the PNG copies.');
const temporary = await mkdtemp(path.join(tmpdir(), 'trolleybus-review-'));
try {
  for (const [name, height] of [
    ['reference-board', 1080],
    ['comparison', 1860],
  ]) {
    await new Promise((resolve, reject) => {
      const child = spawn(
        chrome,
        [
          '--headless=new',
          '--disable-gpu',
          '--no-first-run',
          '--no-default-browser-check',
          `--user-data-dir=${path.join(temporary, name)}`,
          `--screenshot=${path.join(output, name + '.png')}`,
          `--window-size=1800,${height}`,
          '--force-device-scale-factor=1',
          '--hide-scrollbars',
          '--virtual-time-budget=2500',
          pathToFileURL(path.join(output, name + '.html')).href,
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let diagnostics = '';
      child.stderr.on('data', (data) => {
        diagnostics = (diagnostics + data).slice(-2000);
      });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(diagnostics))));
    });
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.log(`${gate} reference and comparison sheets saved for iteration ${iteration}.`);
