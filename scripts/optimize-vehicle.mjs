import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune } from '@gltf-transform/functions';
import validator from 'gltf-validator';

const base = new URL('../assets/vehicles/bkm32100d/', import.meta.url);
const config = JSON.parse(await readFile(new URL('model.json', base), 'utf8'));
await mkdir(new URL('exports/', base), { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const variants = [
  [
    'gameplay',
    'bkm32100d.raw.glb',
    new URL('../src/rendering/vehicles/assets/bkm32100d.glb', import.meta.url),
  ],
  ['lod0', 'bkm32100d-lod0.raw.glb', new URL('exports/bkm32100d-lod0.glb', base)],
  ['lod2', 'bkm32100d-lod2.raw.glb', new URL('exports/bkm32100d-lod2.glb', base)],
];
const reports = {};
for (const [name, source, output] of variants) {
  const document = await io.read(fileURLToPath(new URL(`source/${source}`, base)));
  for (const mesh of document.getRoot().listMeshes())
    for (const primitive of mesh.listPrimitives())
      if (!primitive.getMaterial()?.getNormalTexture()) primitive.setAttribute('TANGENT', null);
  const before = document
    .getRoot()
    .listNodes()
    .map((node) => node.getName())
    .sort();
  await document.transform(
    dedup(),
    prune({ keepLeaves: true, keepExtras: true, keepAttributes: true }),
  );
  const root = document.getRoot();
  const after = root
    .listNodes()
    .map((node) => node.getName())
    .sort();
  if (JSON.stringify(before) !== JSON.stringify(after))
    throw new Error('Optimization changed node names.');
  await io.write(fileURLToPath(output), document);
  const bytes = await readFile(output);
  const validation = await validator.validateBytes(new Uint8Array(bytes), { uri: `${name}.glb` });
  const trianglesByLOD = {};
  for (const node of root.listNodes()) {
    const level = String(node.getExtras().lod_level ?? 0);
    for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
      const count =
        (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
      trianglesByLOD[level] = (trianglesByLOD[level] ?? 0) + count;
      if (primitive.getMaterial()?.getBaseColorTexture() && !primitive.getAttribute('TEXCOORD_0'))
        throw new Error('Textured mesh missing UVs.');
    }
  }
  const images = root.listTextures().map((texture) => {
    const image = texture.getImage();
    const width = Buffer.from(image).readUInt32BE(16),
      height = Buffer.from(image).readUInt32BE(20);
    if (texture.getMimeType() !== 'image/png' || Math.max(width, height) > 2048)
      throw new Error('Expected PNG textures no larger than 2K.');
    return { name: texture.getName(), width, height, bytes: image.byteLength };
  });
  reports[name] = {
    bytes: bytes.length,
    nodes: root.listNodes().length,
    meshNodes: root.listNodes().filter((node) => node.getMesh()).length,
    trianglesByLOD,
    materials: root.listMaterials().length,
    textures: images,
    estimatedTextureMiB: images.reduce(
      (sum, t) => sum + (t.width * t.height * 4 * 4) / 3 / 1024 ** 2,
      0,
    ),
    validation: validation.issues,
  };
  if (validation.issues.numErrors || validation.issues.numWarnings)
    throw new Error(`${name} GLB validation failed: ${JSON.stringify(validation.issues)}`);
  console.log(
    `${name}: ${bytes.length} bytes; triangles ${JSON.stringify(trianglesByLOD)}; ${images.length} PNGs; validation clean.`,
  );
}
await writeFile(
  new URL('source/export-report.json', base),
  JSON.stringify({ stage: config.stage, ...reports }, null, 2) + '\n',
);
