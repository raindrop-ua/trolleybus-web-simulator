import * as THREE from 'three';
import type { WorldDefinition } from '../../domain/types';
import { Batch, box, labelTexture, material, mergeStaticEnvironment } from './primitives';
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
  const foliage = new Batch(new THREE.IcosahedronGeometry(1, 1), white);
  const conifers = new Batch(new THREE.ConeGeometry(1, 1, 8), white);
  const trunks = new Batch(new THREE.CylinderGeometry(0.16, 0.21, 1, 7), white);
  const rounds = new Batch(new THREE.CylinderGeometry(1, 1, 1, 12), white);
  const carWheels = new Batch(new THREE.CylinderGeometry(1, 1, 1, 12).rotateZ(Math.PI / 2), white);
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
      cubes.add(x, height + 0.08, z, width + 0.45, 0.2, depth + 0.45, '#818b80');
      // Raised parapets leave the roof surface and its equipment visible from above.
      for (const side of [-1, 1]) {
        cubes.add(x, height + 0.4, z + (side * depth) / 2, width + 0.45, 0.5, 0.22, '#b9b8a7');
        cubes.add(x + (side * width) / 2, height + 0.4, z, 0.22, 0.5, depth, '#b9b8a7');
        cubes.add(
          x + side * (width / 2 - 0.2),
          height / 2,
          z + depth / 2 + 0.13,
          0.11,
          height,
          0.11,
          '#89958b',
        );
      }
      cubes.add(x, 0.42, z, width + 0.3, 0.9, depth + 0.3, '#a8aa94');
      cubes.add(x + width * 0.22, height + 0.95, z - 2, 3.8, 1.2, 3.2, '#bdbaa9');
      cubes.add(x + width * 0.22, height + 1.61, z - 2, 4, 0.13, 3.4, '#8c978f');
      cubes.add(x - width * 0.24, height + 0.59, z + 1.8, 2.2, 0.85, 1.3, '#b4bcb4');
      for (let fin = 0; fin < 6; fin++)
        cubes.add(
          x - width * 0.24 - 0.85 + fin * 0.34,
          height + 1.03,
          z + 1.8,
          0.12,
          0.035,
          1.08,
          '#687b78',
        );
      rounds.add(x + 2, height + 0.55, z + 3, 0.25, 0.85, 0.25, '#8b9286');
      rounds.add(x + 2, height + 1.01, z + 3, 0.37, 0.12, 0.37, '#bdbaa9');
      for (let floor = 1; floor < floors; floor++)
        for (const side of [-1, 1])
          cubes.add(
            x,
            floor * 3 + 0.45,
            z + side * (depth / 2 + 0.04),
            width,
            0.12,
            0.11,
            '#d4cfbb',
          );
      const cols = Math.floor(width / 3.4);
      for (let floor = 0; floor < floors; floor++)
        for (let column = 0; column < cols; column++) {
          const wx = x - width / 2 + 2.4 + column * 3.4,
            wy = 2 + floor * 3;
          for (const side of [-1, 1]) {
            const faceZ = z + side * (depth / 2 + 0.035);
            cubes.add(wx, wy, faceZ, 1.81, 1.86, 0.06, '#e1ddcd');
            cubes.add(
              wx,
              wy,
              faceZ + side * 0.045,
              1.55,
              1.55,
              0.065,
              rand() > 0.18 ? '#768a85' : '#cfb88b',
            );
            cubes.add(wx, wy, faceZ + side * 0.086, 0.065, 1.55, 0.035, '#c1c6b8');
            cubes.add(wx, wy + 0.3, faceZ + side * 0.087, 1.55, 0.055, 0.035, '#c1c6b8');
            cubes.add(wx, wy - 0.9, z + side * (depth / 2 + 0.16), 1.8, 0.15, 0.43, '#e8dfc9');
            if (column % 3 === 0 && floor > 0) {
              cubes.add(wx, wy - 0.96, z + side * (depth / 2 + 0.55), 2.05, 0.16, 1.18, '#c6c3ae');
              cubes.add(wx, wy - 0.36, z + side * (depth / 2 + 1.08), 2.05, 0.07, 0.07, '#7a8a81');
              for (let rail = 0; rail < 6; rail++)
                cubes.add(
                  wx - 0.95 + rail * 0.38,
                  wy - 0.65,
                  z + side * (depth / 2 + 1.08),
                  0.045,
                  0.6,
                  0.045,
                  '#7a8a81',
                );
              for (const edge of [-1, 1])
                cubes.add(
                  wx + edge * 0.98,
                  wy - 0.36,
                  z + side * (depth / 2 + 0.55),
                  0.07,
                  0.07,
                  1.05,
                  '#7a8a81',
                );
              if ((floor + column) % 2 === 0) {
                cubes.add(
                  wx + 0.4,
                  wy - 0.71,
                  z + side * (depth / 2 + 0.9),
                  0.65,
                  0.25,
                  0.32,
                  '#9e8069',
                );
                foliage.add(
                  wx + 0.4,
                  wy - 0.51,
                  z + side * (depth / 2 + 0.9),
                  0.4,
                  0.25,
                  0.24,
                  '#80956b',
                );
              }
            } else if (floor > 0 && (column + floor) % 4 === 1) {
              cubes.add(wx + 1.07, wy - 0.5, faceZ + side * 0.35, 0.64, 0.47, 0.52, '#c7c9bc');
              rounds.add(wx + 1.07, wy - 0.24, faceZ + side * 0.35, 0.2, 0.025, 0.2, '#88998f');
            }
          }
        }
      for (let floor = 0; floor < floors; floor++)
        for (let col = 0; col < 3; col++)
          for (const side of [-1, 1]) {
            const wz = z - depth / 2 + 2.4 + col * 3.4;
            cubes.add(
              x + side * (width / 2 + 0.025),
              2 + floor * 3,
              wz,
              0.065,
              1.83,
              1.75,
              '#ddd9c8',
            );
            cubes.add(
              x + side * (width / 2 + 0.075),
              2 + floor * 3,
              z - depth / 2 + 2.4 + col * 3.4,
              0.07,
              1.55,
              1.45,
              '#788a85',
            );
            cubes.add(
              x + side * (width / 2 + 0.12),
              2 + floor * 3,
              wz,
              0.04,
              1.55,
              0.065,
              '#bdc4b7',
            );
          }
      // Entry awning and a small warm shopfront on the boulevard side.
      const facing = z > 0 ? -1 : 1;
      cubes.add(x, 2.3, z + facing * (depth / 2 + 0.8), 5, 0.28, 1.8, '#71887a');
      cubes.add(x, 1, z + facing * (depth / 2 + 0.06), 2, 2, 0.1, '#566e67');
      cubes.add(x, 1, z + facing * (depth / 2 + 0.13), 0.07, 1.9, 0.05, '#a8b7a5');
      cubes.add(x + 0.3, 1, z + facing * (depth / 2 + 0.18), 0.06, 0.42, 0.07, '#d1c8a7');
      for (let step = 0; step < 2; step++)
        cubes.add(
          x,
          0.06 + step * 0.08,
          z + facing * (depth / 2 + 0.56 - step * 0.18),
          2.7,
          0.12,
          1 - step * 0.28,
          '#c6c5b2',
        );
      cubes.add(x - 3.3, 0.72, z + facing * (depth / 2 + 0.16), 1.7, 1.4, 0.18, '#a5b3a5');
      for (let shutter = 0; shutter < 7; shutter++)
        cubes.add(
          x - 3.3,
          0.15 + shutter * 0.2,
          z + facing * (depth / 2 + 0.26),
          1.66,
          0.045,
          0.04,
          '#8e9c92',
        );
      cubes.add(x + 3.2, 0.4, z + facing * (depth / 2 + 1), 2.6, 0.7, 0.9, '#a9ac92');
      foliage.add(x + 3.2, 0.93, z + facing * (depth / 2 + 1), 1.3, 0.55, 0.58, '#7b9368');
    }
  // The civic square: paving, a fountain and a few steps.
  box(group, [42, 0.11, 24], [4, -0.02, 36], material('#d7d0b8'));
  for (let x = -16; x <= 24; x += 2) cubes.add(x, 0.041, 36, 0.035, 0.012, 23.8, '#bdbdaa');
  for (let z = 25; z <= 47; z += 2) cubes.add(4, 0.042, z, 41.8, 0.012, 0.035, '#bdbdaa');
  for (const x of [-13, 21]) {
    cubes.add(x, 0.25, 28, 4, 0.5, 2.3, '#b7b69b');
    for (let shrub = 0; shrub < 3; shrub++)
      foliage.add(x - 1.25 + shrub * 1.25, 0.74, 28, 0.85, 0.68, 0.76, '#819365');
  }
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
    const type = rand();
    trunks.add(x, height * 0.28, z, size, height * 0.56, size, '#8a8064');
    if (type < 0.22) {
      for (let tier = 0; tier < 3; tier++)
        conifers.add(
          x,
          height * (0.48 + tier * 0.18),
          z,
          size * (1.75 - tier * 0.39),
          height * 0.56,
          size * (1.75 - tier * 0.39),
          tier % 2 ? '#718967' : '#819467',
          tier * 0.4,
        );
    } else if (type > 0.82) {
      foliage.add(
        x,
        height * 0.78,
        z,
        1.25 * size,
        height * 0.67,
        1.25 * size,
        treeColors[Math.floor(rand() * treeColors.length)],
      );
    } else {
      const color = treeColors[Math.floor(rand() * treeColors.length)];
      foliage.add(
        x,
        height * 0.76,
        z,
        1.65 * size,
        height * 0.43,
        1.65 * size,
        color,
        rand() * 6.28,
      );
      for (let crown = 0; crown < 3; crown++) {
        const angle = (crown * Math.PI * 2) / 3 + type * 5;
        foliage.add(
          x + Math.cos(angle) * 1.15 * size,
          height * (0.62 + rand() * 0.13),
          z + Math.sin(angle) * 1.15 * size,
          1.25 * size,
          height * 0.3,
          1.3 * size,
          treeColors[(Math.floor(type * 10) + crown) % treeColors.length],
          angle,
        );
      }
    }
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
    for (let slat = 0; slat < 4; slat++)
      cubes.add(x, 0.9, z - 0.3 + slat * 0.2, 3.6, 0.12, 0.16, '#a58a60');
    for (let slat = 0; slat < 3; slat++)
      cubes.add(x, 1.09 + slat * 0.21, z + 0.35, 3.6, 0.16, 0.13, '#b09a72');
    for (const side of [-1, 1]) cubes.add(x + side * 1.3, 0.43, z, 0.13, 0.85, 0.5, '#697c6c');
    for (const side of [-1, 1]) {
      cubes.add(x + side * 1.5, 1.07, z, 0.075, 0.39, 0.08, '#697c6c');
      cubes.add(x + side * 1.5, 1.25, z, 0.075, 0.08, 0.65, '#697c6c');
    }
    rounds.add(x + 2.7, 0.62, z + 0.2, 0.36, 1.15, 0.36, '#728879');
    rounds.add(x + 2.7, 1.22, z + 0.2, 0.39, 0.08, 0.39, '#506f65');
    rounds.add(x + 2.7, 1.265, z + 0.2, 0.21, 0.01, 0.21, '#344c45');
  }
  // Parked cars remain scenery, separate from the autonomous fleet.
  for (const [i, x] of [-151, -110, -45, 43, 112].entries()) {
    const z = i % 2 === 0 ? 22 : -23;
    const color = ['#b2b9ad', '#d4c19a', '#a47a68', '#809b9b', '#d9d5c3'][i];
    cubes.add(x, 0.55, z, 1.82, 0.63, 4.1, color);
    cubes.add(x, 0.92, z + 1.38, 1.72, 0.13, 1.25, color);
    cubes.add(x, 1.12, z - 0.18, 1.51, 0.61, 2.12, '#556d6c');
    cubes.add(x, 1.48, z - 0.24, 1.54, 0.12, 1.85, color);
    for (const side of [-1, 1]) {
      for (const end of [-1, 1]) {
        carWheels.add(x + side * 0.88, 0.34, z + end * 1.32, 0.2, 0.32, 0.32, '#3b4642');
        carWheels.add(x + side * 0.991, 0.34, z + end * 1.32, 0.025, 0.19, 0.19, '#99a59c');
        cubes.add(
          x + side * 0.6,
          0.68,
          z + end * 2.06,
          0.42,
          0.2,
          0.035,
          end === 1 ? '#e4dcc0' : '#a56855',
        );
        cubes.add(x + side * 0.775, 1.13, z - 0.18 + end * 0.93, 0.07, 0.61, 0.08, color);
      }
      cubes.add(x + side * 0.78, 1.13, z - 0.3, 0.07, 0.61, 0.085, color);
      cubes.add(x + side * 0.92, 0.8, z - 0.53, 0.025, 0.055, 0.19, '#d6d8c9');
      cubes.add(x + side * 1.02, 1.05, z + 0.56, 0.25, 0.15, 0.24, color);
      cubes.add(x + side * 0.925, 0.5, z, 0.025, 0.06, 3.4, '#6c7970');
    }
    for (const end of [-1, 1]) {
      cubes.add(x, 0.42, z + end * 2.07, 1.7, 0.12, 0.08, '#697970');
      cubes.add(x, 0.66, z + end * 2.085, 0.42, 0.11, 0.02, '#e5e3d1');
    }
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
  conifers.build(group);
  trunks.build(group);
  rounds.build(group);
  carWheels.build(group);
  mergeStaticEnvironment(group);
  return group;
}
