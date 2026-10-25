import * as THREE from 'three';
import type { RoadPath, WorldDefinition } from '../../domain/types';
import { Batch, box, labelTexture, material, mergeStaticEnvironment, rod } from './primitives';
import { surfaceTexture } from './surfaceTextures';
import { CROSS_STREET_X, ROUTE_SCALE } from '../../data/layout';

function ribbon(road: RoadPath, width: number, y: number, color: string, map?: THREE.Texture) {
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const count = Math.ceil(road.length / 1.2);
  for (let i = 0; i <= count; i++) {
    const { position: p, tangent: t } = road.sample((i / count) * road.length);
    const nx = (t.z * width) / 2;
    const nz = (-t.x * width) / 2;
    vertices.push(p.x - nx, y, p.z - nz, p.x + nx, y, p.z + nz);
    uvs.push((p.x - nx) / 4, (p.z - nz) / 4, (p.x + nx) / 4, (p.z + nz) / 4);
    if (i < count) {
      const j = i * 2;
      indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, map, side: THREE.DoubleSide, roughness: 1 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

export function createRoadScene(world: WorldDefinition) {
  const group = new THREE.Group();
  const curb = '#d7d2bb';
  group.add(ribbon(world.road, 12, -0.065, '#ffffff', surfaceTexture('paving')));
  group.add(ribbon(world.road, 8.1, -0.025, '#ffffff', surfaceTexture('asphalt')));
  const paint = material('#e7e2c9');
  const yellow = material('#dec67f');
  const pole = material('#718180');
  const shelterGlass = new THREE.MeshStandardMaterial({
    color: '#a6c0b7',
    roughness: 0.3,
    metalness: 0.08,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const streetDetails = new Batch(new THREE.BoxGeometry(1, 1, 1), material('#ffffff'));
  const drain = material('#526967');
  for (let distance = 0; distance < world.road.length; distance += 2.5) {
    const s = world.road.sample(distance);
    if (CROSS_STREET_X.some((x) => Math.abs(s.position.x - x) < 7)) continue;
    for (const side of [-1, 1]) {
      streetDetails.add(
        s.position.x + side * s.tangent.z * 4.15,
        0.005,
        s.position.z - side * s.tangent.x * 4.15,
        0.18,
        0.13,
        2.42,
        distance % 10 < 5 ? '#d7d3c1' : '#cbcbb9',
        s.yaw,
      );
    }
  }
  for (let distance = 12; distance < world.road.length; distance += 53) {
    const s = world.road.sample(distance);
    if (CROSS_STREET_X.some((x) => Math.abs(s.position.x - x) < 7)) continue;
    const grate = new THREE.Group();
    grate.position.set(s.position.x - s.tangent.z * 3.82, 0.002, s.position.z + s.tangent.x * 3.82);
    grate.rotation.y = s.yaw;
    group.add(grate);
    box(grate, [0.43, 0.014, 0.9], [0, 0, 0], drain);
    for (let slot = 0; slot < 6; slot++)
      box(grate, [0.33, 0.01, 0.055], [0, 0.012, -0.34 + slot * 0.13], material('#89958a'));
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.018, 16), drain);
    cover.position.set(
      s.position.x + s.tangent.z * 1.35,
      -0.002,
      s.position.z - s.tangent.x * 1.35,
    );
    cover.receiveShadow = true;
    group.add(cover);
  }
  for (let distance = 0; distance < world.road.length; distance += 7) {
    const s = world.road.sample(distance);
    if (Math.abs(s.curvature) > 0.035) continue;
    const dash = box(
      group,
      [0.12, 0.025, 2.4],
      [s.position.x + s.tangent.z * 3.5, 0.005, s.position.z - s.tangent.x * 3.5],
      paint,
    );
    dash.rotation.y = s.yaw;
  }
  // The cross streets are shared city geometry, with zebra crossings at the boulevard.
  for (const x of CROSS_STREET_X) {
    box(group, [13, 0.08, 168 * ROUTE_SCALE], [x, -0.11, 0], material(curb));
    box(group, [9, 0.06, 168 * ROUTE_SCALE], [x, -0.045, 0], material('#697575'));
    for (let z = -78 * ROUTE_SCALE; z <= 78 * ROUTE_SCALE; z += 10)
      if (Math.abs(z) > 16 * ROUTE_SCALE) box(group, [0.14, 0.02, 3.6], [x, 0.001, z], paint);
    const closest = Array.from({ length: 300 }, (_, i) =>
      world.road.sample((world.road.length * i) / 300),
    )
      .filter((s) => s.tangent.x > 0)
      .sort((a, b) => Math.abs(a.position.x - x) - Math.abs(b.position.x - x))[0];
    const z = closest?.position.z ?? 0;
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++)
        box(group, [0.68, 0.028, 3.4], [x - 3 + i, 0.02, z + side * 10], paint);
  }
  for (const stop of world.stops) {
    const s = world.road.sample(stop.distance);
    const stopGroup = new THREE.Group();
    stopGroup.position.set(s.position.x, 0, s.position.z);
    stopGroup.rotation.y = s.yaw;
    group.add(stopGroup);
    // Doors sit on local -X, and the platform sits on the same side.
    box(stopGroup, [1.7, 0.19, 19], [-5, 0.015, -0.6], material('#e4d5b0'));
    box(stopGroup, [0.18, 0.03, 15], [-4.25, 0.125, -0.6], yellow);
    // Tactile ribs and paving joints read clearly when following a vehicle.
    for (let z = -8; z < 7; z += 0.3)
      box(stopGroup, [0.35, 0.018, 0.055], [-4.54, 0.124, z], material('#c7b480'));
    for (let z = -9; z < 9; z += 1.5)
      box(stopGroup, [1.1, 0.012, 0.025], [-5.15, 0.116, z], material('#c8bea1'));
    box(stopGroup, [3.1, 0.18, 7.2], [-7.4, 3.4, -2], material('#53696a'));
    box(stopGroup, [3.2, 0.08, 7.3], [-7.4, 3.54, -2], material('#849992'));
    box(stopGroup, [0.1, 0.1, 6.9], [-8.85, 3.42, -2], material('#3e595a'));
    const backGlass = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 2.92), shelterGlass);
    backGlass.position.set(-8.78, 1.71, -2);
    backGlass.rotation.y = -Math.PI / 2;
    stopGroup.add(backGlass);
    const endGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 2.92), shelterGlass);
    endGlass.position.set(-7.38, 1.71, -5.35);
    stopGroup.add(endGlass);
    for (const z of [-5.3, 1.3]) {
      box(stopGroup, [0.12, 3.3, 0.12], [-6, 1.65, z], pole);
      box(stopGroup, [2.8, 0.08, 0.08], [-7.4, 0.25, z], pole);
    }
    for (const z of [-5.3, -3.1, -0.9, 1.3])
      box(stopGroup, [0.12, 3.3, 0.12], [-8.8, 1.65, z], pole);
    for (const y of [0.25, 1.1, 3.18]) box(stopGroup, [0.075, 0.065, 6.8], [-8.8, y, -2], pole);
    box(stopGroup, [0.045, 3.25, 0.045], [-8.86, 1.63, 1.43], material('#637c74'));
    for (let slat = 0; slat < 4; slat++)
      box(stopGroup, [0.2, 0.13, 4.8], [-8.07 + slat * 0.24, 0.8, -2], material('#ae8562'));
    for (let slat = 0; slat < 3; slat++)
      box(stopGroup, [0.11, 0.15, 4.8], [-8.15, 1.02 + slat * 0.2, -2], material('#b1936c'));
    for (const z of [-3.8, -0.2]) box(stopGroup, [0.65, 0.7, 0.12], [-7.8, 0.4, z], pole);
    box(stopGroup, [0.7, 1, 0.65], [-6.2, 0.5, 2.45], material('#6d877b'));
    box(stopGroup, [0.76, 0.1, 0.71], [-6.2, 1.05, 2.45], material('#536d66'));
    box(stopGroup, [0.42, 0.06, 0.04], [-6.2, 0.87, 2.79], material('#344e49'));
    box(stopGroup, [0.13, 4.1, 0.13], [-5.2, 2.05, 5], pole);
    box(stopGroup, [0.13, 1.22, 0.85], [-5.2, 3.65, 5], material('#3287ad'));
    box(stopGroup, [0.135, 0.7, 0.65], [-5.2, 3.75, 5], material('#eceddb'));
    box(stopGroup, [0.14, 0.3, 0.45], [-5.2, 3.78, 5], material('#437d88'));
    for (const z of [4.84, 5.16])
      box(stopGroup, [0.15, 0.08, 0.09], [-5.2, 3.55, z], material('#437d88'));
    box(stopGroup, [0.09, 0.74, 0.46], [-5.2, 2.42, 5], material('#e3deca'));
    for (let line = 0; line < 4; line++)
      box(stopGroup, [0.1, 0.025, 0.32], [-5.2, 2.62 - line * 0.13, 5], material('#8a9b8e'));
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.38),
      new THREE.MeshBasicMaterial({ map: labelTexture(stop.shortName), side: THREE.DoubleSide }),
    );
    sign.position.set(-8.91, 2.7, -2);
    sign.rotation.y = -Math.PI / 2;
    stopGroup.add(sign);
    for (let i = 0; i < 3; i++) {
      const person = new THREE.Group();
      person.position.set(-5.25 - i * 0.65, 0, -3 + i * 2);
      stopGroup.add(person);
      const torso = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, 0.72, 5),
        material(['#688a9a', '#b98162', '#d3b46d'][i]),
      );
      torso.position.y = 1.06;
      person.add(torso);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.23, 0), material('#dbb18b'));
      head.position.y = 1.67;
      person.add(head);
      const hair = new THREE.Mesh(
        new THREE.SphereGeometry(0.232, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        material('#6e6b58'),
      );
      hair.position.y = 1.71;
      person.add(hair);
      for (const leg of [-0.12, 0.12]) {
        box(person, [0.16, 0.7, 0.17], [leg, 0.35, 0], material('#4e6065'));
        box(person, [0.17, 0.12, 0.28], [leg, 0.07, 0.04], material('#4b5753'));
      }
      for (const side of [-1, 1]) {
        const sleeve = box(
          person,
          [0.15, 0.53, 0.17],
          [side * 0.27, 1.01, 0],
          material(['#688a9a', '#b98162', '#d3b46d'][i]),
        );
        sleeve.rotation.z = side * 0.12;
        box(person, [0.12, 0.13, 0.13], [side * 0.3, 0.7, 0], material('#dbb18b'));
      }
      if (i === 1) box(person, [0.17, 0.45, 0.34], [0.39, 0.47, 0], material('#9a8b70'));
    }
    const mark = box(stopGroup, [0.11, 0.022, 12], [-2.8, 0.025, 0], yellow);
    mark.name = stop.id;
  }
  // Occasional cantilever street lamps. Their light is represented by warm diffusers.
  for (let d = 0; d < world.road.length; d += 42) {
    const s = world.road.sample(d);
    const right = new THREE.Vector3(-s.tangent.z, 0, s.tangent.x);
    const base = new THREE.Vector3(s.position.x, 0, s.position.z).addScaledVector(right, 6.2);
    const top = base.clone().setY(8.3);
    rod(group, base, top, 0.095, pole);
    const end = top
      .clone()
      .addScaledVector(right, -2.8)
      .add(new THREE.Vector3(0, 0.5, 0));
    rod(group, top, end, 0.075, pole);
    box(group, [0.45, 0.12, 1.1], [end.x, end.y, end.z], material('#f3e4b5'));
  }
  streetDetails.build(group);
  mergeStaticEnvironment(group);
  return group;
}
