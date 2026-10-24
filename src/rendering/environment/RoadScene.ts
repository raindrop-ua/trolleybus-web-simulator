import * as THREE from 'three';
import type { RoadPath, WorldDefinition } from '../../domain/types';
import { box, labelTexture, material, rod } from './primitives';

function ribbon(road: RoadPath, width: number, y: number, color: string) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const count = Math.ceil(road.length / 1.2);
  for (let i = 0; i <= count; i++) {
    const { position: p, tangent: t } = road.sample((i / count) * road.length);
    const nx = (t.z * width) / 2;
    const nz = (-t.x * width) / 2;
    vertices.push(p.x - nx, y, p.z - nz, p.x + nx, y, p.z + nz);
    if (i < count) {
      const j = i * 2;
      indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 1 }),
  );
  mesh.receiveShadow = true;
  return mesh;
}

export function createRoadScene(world: WorldDefinition) {
  const group = new THREE.Group();
  const curb = '#d7d2bb';
  group.add(ribbon(world.road, 12, -0.065, curb));
  group.add(ribbon(world.road, 8.1, -0.025, '#697575'));
  const paint = material('#e7e2c9');
  const yellow = material('#dec67f');
  const pole = material('#718180');
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
  for (const x of [-77, 77]) {
    box(group, [13, 0.08, 168], [x, -0.11, 0], material(curb));
    box(group, [9, 0.06, 168], [x, -0.045, 0], material('#697575'));
    for (let z = -78; z <= 78; z += 10)
      if (Math.abs(z) > 16) box(group, [0.14, 0.02, 3.6], [x, 0.001, z], paint);
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
    box(stopGroup, [3.1, 0.18, 7.2], [-7.4, 3.4, -2], material('#53696a'));
    box(stopGroup, [0.15, 3.3, 7], [-8.8, 1.65, -2], material('#94b5aa'));
    for (const z of [-5.3, 1.3]) box(stopGroup, [0.12, 3.3, 0.12], [-6, 1.65, z], pole);
    box(stopGroup, [1.1, 0.16, 4.8], [-7.7, 0.8, -2], material('#ae8562'));
    box(stopGroup, [0.13, 4.1, 0.13], [-5.2, 2.05, 5], pole);
    box(stopGroup, [0.13, 1.22, 0.85], [-5.2, 3.65, 5], material('#3287ad'));
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
      for (const leg of [-0.12, 0.12])
        box(person, [0.16, 0.7, 0.17], [leg, 0.35, 0], material('#4e6065'));
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
  return group;
}
