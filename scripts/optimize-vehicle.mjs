import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune } from '@gltf-transform/functions';
import validator from 'gltf-validator';

const input = new URL('../assets/vehicles/bkm32100d/source/bkm32100d.raw.glb', import.meta.url);
const output = new URL('../src/rendering/vehicles/assets/bkm32100d.glb', import.meta.url);
const reportUrl = new URL(
  '../assets/vehicles/bkm32100d/source/export-report.json',
  import.meta.url,
);
const io = new NodeIO();
const document = await io.read(fileURLToPath(input));
const before = document
  .getRoot()
  .listNodes()
  .map((node) => node.getName())
  .sort();
// Keep all named motion pivots; geometry is batched in Blender's export copy.
await document.transform(
  dedup(),
  prune({ keepLeaves: true, keepExtras: true, keepAttributes: true }),
);
const after = document
  .getRoot()
  .listNodes()
  .map((node) => node.getName())
  .sort();
if (JSON.stringify(before) !== JSON.stringify(after))
  throw new Error('Optimization changed node names.');
await io.write(fileURLToPath(output), document);
const bytes = await readFile(output);
const validation = await validator.validateBytes(new Uint8Array(bytes), { uri: 'bkm32100d.glb' });
const root = document.getRoot();
let triangles = 0;
for (const node of root.listNodes()) {
  for (const primitive of node.getMesh()?.listPrimitives() ?? [])
    triangles +=
      (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
}
const report = {
  stage: 'geometry-review',
  bytes: bytes.length,
  nodes: root.listNodes().length,
  meshNodes: root.listNodes().filter((node) => node.getMesh()).length,
  triangles,
  materials: root.listMaterials().length,
  textures: root.listTextures().length,
  validation: validation.issues,
};
await writeFile(reportUrl, JSON.stringify(report, null, 2) + '\n');
if (validation.issues.numErrors || validation.issues.numWarnings)
  throw new Error(`GLB validation failed: ${JSON.stringify(validation.issues)}`);
if (report.textures !== 0) throw new Error('Geometry review GLB must contain no textures.');
console.log(JSON.stringify(report, null, 2));
