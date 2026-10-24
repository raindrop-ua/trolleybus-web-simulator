import * as THREE from 'three';
import type { WorldDefinition } from '../../domain/types';
import { Batch, box, labelTexture, material } from './primitives';
import { CITY_SETTINGS } from '../../data/presentation';

function random(seed: number) {
  let value = seed;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function island() {
  const group = new THREE.Group();
  const shape = new THREE.Shape();
  const w = 224,
    h = 112,
    r = 12;
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 6,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.7,
    bevelThickness: 0.7,
    curveSegments: 6,
  });
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material('#b7c5a1'));
  mesh.position.y = -6.85;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  group.add(mesh);
  return group;
}

export function createCity(world: WorldDefinition) {
  const group = island();
  const rand = random(CITY_SETTINGS.seed);
  const white = material('#ffffff');
  const cubes = new Batch(new THREE.BoxGeometry(1, 1, 1), white);
  const foliage = new Batch(new THREE.IcosahedronGeometry(1, 0), white);
  const trunks = new Batch(new THREE.CylinderGeometry(0.16, 0.21, 1, 5), white);
  const roadSamples = Array.from(
    { length: 800 },
    (_, i) => world.road.sample((i / 800) * world.road.length).position,
  );
  const nearest = (x: number, z: number) =>
    Math.sqrt(Math.min(...roadSamples.map((p) => (p.x - x) ** 2 + (p.z - z) ** 2)));
  // A quiet river defines the far edge of the district.
  box(group, [432, 0.12, 22], [0, -0.07, -89], material('#87b9bc', 0.6));
  for (const z of [-102, -76]) box(group, [430, 0.16, 5], [0, -0.02, z], material('#ded8bd'));
  for (let i = 0; i < 52; i++) {
    const x = -209 + rand() * 418,
      z = -98 + rand() * 18;
    cubes.add(x, 0.015, z, 2 + rand() * 7, 0.025, 0.12, '#b0d4ce');
  }
  for (const x of [-77, 77]) {
    box(group, [13, 0.32, 31], [x, 0.12, -89], material('#c7c5b4'));
    box(group, [9, 0.07, 32], [x, 0.33, -89], material('#707c7b'));
    for (const side of [-1, 1]) {
      box(group, [0.2, 0.2, 31], [x + side * 5.8, 1.6, -89], material('#8e9c93'));
      for (let z = -103; z < -74; z += 3)
        box(group, [0.13, 1.5, 0.13], [x + side * 5.8, 0.85, z], material('#8e9c93'));
    }
  }
  // Apartments: restrained plaster colours, flat roofs, balconies, and repeated windows.
  const colors = CITY_SETTINGS.buildingColors;
  for (let x = -186; x <= 186; x += 32)
    for (const z of [-57, -30, 37, 68]) {
      if (Math.abs(x - 77) < 13 || Math.abs(x + 77) < 13 || nearest(x, z) < 20) continue;
      if ((x > 105 && z > 0) || (x < -125 && z < -35)) continue;
      const width = 16 + rand() * 8,
        depth = 11 + rand() * 5,
        floors = 2 + Math.floor(rand() * 5),
        height = floors * 3;
      const color = colors[Math.floor(rand() * colors.length)];
      cubes.add(x, height / 2 - 0.08, z, width, height, depth, color);
      cubes.add(x, height + 0.28, z, width + 0.7, 0.65, depth + 0.7, '#818b80');
      cubes.add(x, 0.42, z, width + 0.3, 0.9, depth + 0.3, '#a8aa94');
      cubes.add(x + width * 0.22, height + 0.95, z - 2, 3.8, 1.2, 3.2, '#bdbaa9');
      const cols = Math.floor(width / 3.4);
      for (let floor = 0; floor < floors; floor++)
        for (let column = 0; column < cols; column++) {
          const wx = x - width / 2 + 2.4 + column * 3.4,
            wy = 2 + floor * 3;
          for (const side of [-1, 1]) {
            cubes.add(
              wx,
              wy,
              z + side * (depth / 2 + 0.035),
              1.55,
              1.55,
              0.065,
              rand() > 0.18 ? '#768a85' : '#cfb88b',
            );
            cubes.add(wx, wy - 0.9, z + side * (depth / 2 + 0.16), 1.8, 0.15, 0.43, '#e8dfc9');
            if (column % 3 === 0 && floor > 0) {
              cubes.add(wx, wy - 0.45, z + side * (depth / 2 + 0.6), 2, 0.75, 1.1, '#c6c3ae');
              cubes.add(wx, wy + 0.15, z + side * (depth / 2 + 0.95), 1.9, 0.5, 0.12, '#8c9b90');
            }
          }
        }
      for (let floor = 0; floor < floors; floor++)
        for (let col = 0; col < 3; col++)
          for (const side of [-1, 1])
            cubes.add(
              x + side * (width / 2 + 0.04),
              2 + floor * 3,
              z - depth / 2 + 2.4 + col * 3.4,
              0.07,
              1.55,
              1.45,
              '#788a85',
            );
      // Entry awning and a small warm shopfront on the boulevard side.
      const facing = z > 0 ? -1 : 1;
      cubes.add(x, 2.3, z + facing * (depth / 2 + 0.8), 5, 0.28, 1.8, '#71887a');
      cubes.add(x, 1, z + facing * (depth / 2 + 0.06), 2, 2, 0.1, '#566e67');
    }
  // The civic square: paving, a fountain and a few steps.
  box(group, [42, 0.11, 24], [4, -0.02, 36], material('#d7d0b8'));
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(4.1, 4.5, 0.65, 16),
    material('#b3b9a6'),
  );
  fountain.position.set(4, 0.3, 36);
  group.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 0.08, 16), material('#85b3ad'));
  water.position.set(4, 0.66, 36);
  group.add(water);
  const sculpture = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), material('#bcab7f'));
  sculpture.position.set(4, 2.2, 36);
  group.add(sculpture);
  box(group, [2, 0.9, 2], [4, 1.1, 36], material('#d9d2b9'));
  // Park paths and a small pavilion at the east terminal.
  box(group, [69, 0.035, 2.8], [162, -0.06, 55], material('#d9cfad'));
  box(group, [2.8, 0.035, 46], [172, -0.06, 59], material('#d9cfad'));
  box(group, [11, 0.2, 9], [160, 0.04, 69], material('#d3c6a6'));
  for (const x of [155.5, 164.5])
    for (const z of [65.5, 72.5]) cubes.add(x, 1.8, z, 0.25, 3.6, 0.25, '#e3d5b2');
  const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 3, 4), material('#849079'));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(160, 4.9, 69);
  group.add(roof);
  const treeColors = ['#8d9e5d', '#a6ae68', '#748d59', '#97a773', '#b1b979'];
  function tree(x: number, z: number, size = 1) {
    const height = (4.7 + rand() * 2) * size;
    trunks.add(x, height * 0.25, z, 1, height * 0.5, 1, '#8a8064');
    foliage.add(
      x,
      height * 0.76,
      z,
      2.3 * size,
      height * 0.57,
      2.3 * size,
      treeColors[Math.floor(rand() * treeColors.length)],
      rand() * 6.28,
    );
    if (rand() > 0.7)
      foliage.add(
        x + 1.1 * size,
        height * 0.6,
        z + 0.4,
        1.7 * size,
        2 * size,
        1.7 * size,
        '#849758',
      );
  }
  for (let i = 0; i < CITY_SETTINGS.treeCount; i++) {
    const x = -207 + rand() * 414,
      z = -70 + rand() * 164;
    if (nearest(x, z) < 12 || Math.abs(x - 77) < 9 || Math.abs(x + 77) < 9) continue;
    // Keep apartment footprints free of trees.
    const collision = [-57, -30, 37, 68].some(
      (bz) =>
        Math.abs(z - bz) < 11 && Math.abs(((x + 186 + 16) % 32) - 16) < 13 && !(x > 105 && bz > 0),
    );
    if (!collision) tree(x, z, 0.8 + rand() * 0.55);
  }
  for (let d = 14; d < world.road.length; d += 22) {
    const s = world.road.sample(d);
    const x = s.position.x - s.tangent.z * 12,
      z = s.position.z + s.tangent.x * 12;
    if (Math.abs(x - 77) > 10 && Math.abs(x + 77) > 10 && nearest(x, z) > 9) tree(x, z, 0.85);
  }
  // Riverside promenade: repeated trees and wooden benches.
  for (let x = -198; x < 206; x += 22) {
    if (Math.abs(x - 77) > 12 && Math.abs(x + 77) > 12) tree(x, -71, 0.8);
  }
  for (const [x, z] of [
    [22, 46],
    [-15, 46],
    [150, 57],
    [180, 57],
    [-33, -69],
    [33, -69],
  ]) {
    cubes.add(x, 0.9, z, 3.6, 0.16, 0.75, '#a58a60');
    cubes.add(x, 1.3, z + 0.35, 3.6, 0.65, 0.13, '#b09a72');
    for (const side of [-1, 1]) cubes.add(x + side * 1.3, 0.43, z, 0.13, 0.85, 0.5, '#697c6c');
  }
  // Parked cars remain scenery, separate from the autonomous fleet.
  for (const [i, x] of [-151, -110, -45, 43, 112].entries()) {
    const z = i % 2 === 0 ? 22 : -23;
    cubes.add(
      x,
      0.58,
      z,
      1.85,
      1.05,
      4.1,
      ['#b2b9ad', '#d4c19a', '#a47a68', '#809b9b', '#d9d5c3'][i],
    );
    cubes.add(x, 1.3, z - 0.1, 1.55, 0.7, 2.1, '#627a7c');
    for (const side of [-1, 1])
      for (const end of [-1, 1])
        cubes.add(x + side * 0.95, 0.35, z + end * 1.25, 0.2, 0.65, 0.65, '#445350');
  }
  const placard = new THREE.Mesh(
    new THREE.PlaneGeometry(27, 4.6),
    new THREE.MeshBasicMaterial({
      map: labelTexture('ДНІПРО  ·  МАРШРУТ 6', '#60716b', '#e4e4d4'),
    }),
  );
  placard.rotation.x = -Math.PI / 2;
  placard.position.set(-165, -0.05, 86);
  group.add(placard);
  cubes.build(group);
  foliage.build(group);
  trunks.build(group);
  return group;
}
