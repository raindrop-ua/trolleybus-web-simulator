import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createWorldDefinition } from '../data/world';
import { calculatePoleBase } from '../domain/overhead/PoleContactSolver';
import {
  BODY_ROLL_PIVOT_HEIGHT,
  DOOR_LAYOUT,
  FRONT_AXLE,
  POLE_MOUNT,
  REAR_AXLE,
  WHEEL_RADIUS,
} from '../domain/vehicles/VehicleGeometry';
import { createTrolleybus } from '../rendering/vehicles/Trolleybus';
import { SimulationEngine } from '../simulation/SimulationEngine';

let gltf: GLTF;
let document: { images?: unknown[]; textures?: unknown[]; nodes: { name: string }[] };
const world = createWorldDefinition();

beforeAll(async () => {
  const bytes = await readFile(
    new URL('../rendering/vehicles/assets/bkm32100d.glb', import.meta.url),
  );
  document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(gltf);
});
afterAll(() => vi.restoreAllMocks());

describe('Blender vehicle asset contract', () => {
  it('exports a texture-free geometry review with the simulation dimensions and hinge positions', () => {
    expect(document.images ?? []).toHaveLength(0);
    expect(document.textures ?? []).toHaveLength(0);
    expect(new Set(document.nodes.map((node) => node.name)).size).toBe(document.nodes.length);
    const scene = gltf.scene;
    expect(scene.getObjectByName('body-suspension')!.position.y).toBeCloseTo(
      BODY_ROLL_PIVOT_HEIGHT,
      6,
    );
    expect(scene.getObjectByName('body-shell')!.position.y).toBeCloseTo(-BODY_ROLL_PIVOT_HEIGHT, 6);
    for (const [axle, z] of [
      ['front', FRONT_AXLE],
      ['rear', REAR_AXLE],
    ] as const) {
      for (const side of ['left', 'right']) {
        const node = scene.getObjectByName(`wheel-steer-${axle}-${side}`)!;
        expect(node.position.y).toBeCloseTo(WHEEL_RADIUS, 6);
        expect(node.position.z).toBeCloseTo(z, 6);
        expect(scene.getObjectByName(`wheel-spin-${axle}-${side}`)!.parent).toBe(node);
      }
    }
    for (const door of DOOR_LAYOUT) {
      const forward = scene.getObjectByName(`door-${door.id}-forward-pivot`)!;
      const rearward = scene.getObjectByName(`door-${door.id}-rearward-pivot`)!;
      expect(forward.position.z).toBeCloseTo(door.center + door.width / 2 - 0.06, 6);
      expect(rearward.position.z).toBeCloseTo(door.center - door.width / 2 + 0.06, 6);
      expect(forward.parent!.name).toBe('body-shell');
    }
    for (const side of ['left', 'right'])
      expect(scene.getObjectByName(`wiper-${side}-pivot`)).toBeDefined();
  });

  it('keeps exported pole shafts, heads and grounded wheels aligned during translated, yawed body roll', async () => {
    const visual = createTrolleybus('test');
    await visual.ready;
    const snapshot = new SimulationEngine(world, 6).snapshot().vehicles[0];
    try {
      for (const roll of [-0.043633, 0, 0.043633])
        for (const pitch of [-0.02, 0, 0.02]) {
          const position = { x: 13, y: 2, z: -7 },
            yaw = 0.73;
          const posed = { ...snapshot, position, yaw, rollAngle: roll, pitchAngle: pitch };
          posed.poles = [-1, 1].map((side, index) => {
            const base = calculatePoleBase(position, yaw, side, roll, pitch);
            return {
              ...snapshot.poles[index],
              base,
              head: { x: base.x + 0.3, y: base.y + 2.77, z: base.z - 7.285 },
            };
          }) as typeof snapshot.poles;
          visual.update(posed, true, 0);
          visual.group.updateMatrixWorld(true);
          const body = visual.group.getObjectByName('body-shell')!;
          for (const [index, side] of [-1, 1].entries()) {
            const local = new THREE.Vector3(
              side * POLE_MOUNT.halfSpacing,
              POLE_MOUNT.height,
              POLE_MOUNT.longitudinal,
            );
            const expected = posed.poles[index].base;
            expect(
              body
                .localToWorld(local)
                .distanceTo(new THREE.Vector3(expected.x, expected.y, expected.z)),
            ).toBeLessThan(2e-7);
            const sideName = side === -1 ? 'left' : 'right';
            const upper = visual.group.getObjectByName(`pole-${sideName}-shaft-upper`)!;
            const endpoint = upper.localToWorld(new THREE.Vector3(0, 1, 0));
            const head = posed.poles[index].head;
            expect(endpoint.distanceTo(new THREE.Vector3(head.x, head.y, head.z))).toBeLessThan(
              1e-6,
            );
            for (const axle of ['front', 'rear'])
              expect(
                visual.group
                  .getObjectByName(`wheel-steer-${axle}-${sideName}`)!
                  .getWorldPosition(new THREE.Vector3()).y,
              ).toBeCloseTo(position.y + WHEEL_RADIUS, 6);
          }
        }
    } finally {
      visual.dispose();
    }
  });

  it('drives independent door and wheel pivots without changing the other fleet instance', async () => {
    const a = createTrolleybus('a'),
      b = createTrolleybus('b');
    await Promise.all([a.ready, b.ready]);
    const snapshot = new SimulationEngine(world, 6).snapshot().vehicles[0];
    try {
      a.update({ ...snapshot, doorOpen: 1, totalDistance: 2, steeringAngle: 0.2 }, false, 0);
      b.update({ ...snapshot, doorOpen: 0, totalDistance: 0, steeringAngle: 0 }, false, 0);
      expect(a.group.getObjectByName('door-front-forward-pivot')!.rotation.y).toBeCloseTo(-1.42);
      expect(a.group.getObjectByName('wheel-spin-front-left')!.rotation.x).toBeCloseTo(
        2 / WHEEL_RADIUS,
      );
      expect(a.group.getObjectByName('wheel-steer-front-left')!.rotation.y).toBeCloseTo(0.2);
      expect(b.group.getObjectByName('door-front-forward-pivot')!.rotation.y).toBeCloseTo(0);
      expect(b.group.getObjectByName('wheel-spin-front-left')!.rotation.x).toBe(0);
      const meshA = a.group.getObjectsByProperty('type', 'Mesh')[0] as THREE.Mesh;
      const meshB = b.group.getObjectByName(meshA.name) as THREE.Mesh;
      expect(meshA.geometry).toBe(meshB.geometry);
      expect(meshA.material).not.toBe(meshB.material);
    } finally {
      a.dispose();
      b.dispose();
    }
  });

  it('does not attach a late asset after its visual has been disposed', async () => {
    const visual = createTrolleybus('disposed');
    visual.dispose();
    await visual.ready;
    expect(visual.group.children).toHaveLength(0);
    visual.dispose();
  });
});
