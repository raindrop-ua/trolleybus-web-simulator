import * as THREE from 'three';
import type { PoleContact, VehicleSnapshot } from '../../domain/types';
import { WHEEL_RADIUS } from '../../domain/vehicles/VehicleGeometry';
import { acquireVehicleAsset } from './VehicleAsset';

export interface TrolleybusVisual {
  group: THREE.Group;
  ready: Promise<void>;
  setEnvironment(texture: THREE.Texture): void;
  update(snapshot: VehicleSnapshot, selected: boolean, elapsed: number): void;
  dispose(): void;
}

type PoleRig = {
  aim: THREE.Object3D;
  lower: THREE.Object3D;
  upper: THREE.Object3D;
  head: THREE.Object3D;
  rope: THREE.Object3D;
  side: number;
  status?: THREE.MeshStandardMaterial;
};
const UP = new THREE.Vector3(0, 1, 0);

/** Render adapter only. All vehicle meshes and motion pivots come from Blender. */
export function createTrolleybus(id: string, environment?: THREE.Texture): TrolleybusVisual {
  const group = new THREE.Group();
  group.name = `trolleybus-${id}`;
  const lease = acquireVehicleAsset();
  const materials = new Set<THREE.Material>();
  let currentEnvironment = environment;
  let disposed = false;
  let model: THREE.Group | undefined;
  let bound = false;
  let last: { snapshot: VehicleSnapshot; selected: boolean; elapsed: number } | undefined;
  let chassis: THREE.Object3D;
  let suspension: THREE.Object3D;
  let body: THREE.Object3D;
  let wheels: { steer: THREE.Object3D; spin: THREE.Object3D; front: boolean }[] = [];
  let doors: { pivot: THREE.Object3D; direction: number }[] = [];
  let poles: PoleRig[] = [];
  const brakes: THREE.MeshStandardMaterial[] = [];
  // Selection UI marker; this is not authored vehicle geometry.
  const selectionMaterial = new THREE.MeshBasicMaterial({
    color: '#f6ca73',
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const selection = new THREE.Mesh(new THREE.RingGeometry(7, 7.055, 80), selectionMaterial);
  selection.rotation.x = -Math.PI / 2;
  selection.scale.x = 0.285;
  selection.position.y = 0.035;
  selection.visible = false;
  const base = new THREE.Vector3(),
    head = new THREE.Vector3(),
    direction = new THREE.Vector3();
  const drum = new THREE.Vector3(),
    ropeDirection = new THREE.Vector3();

  function updatePole(rig: PoleRig, contact: PoleContact) {
    base.set(contact.base.x, contact.base.y, contact.base.z);
    head.set(contact.head.x, contact.head.y, contact.head.z);
    direction.copy(head).sub(base);
    const length = direction.length();
    rig.aim.visible = length > 0.01;
    direction.normalize();
    rig.aim.position.copy(base);
    rig.aim.quaternion.setFromUnitVectors(UP, direction);
    rig.lower.position.set(0, 0, 0);
    rig.lower.scale.set(1, length * 0.56, 1);
    rig.upper.position.set(0, length * 0.56, 0);
    rig.upper.scale.set(1, length * 0.44, 1);
    rig.head.position.copy(head);
    rig.head.rotation.y = Math.atan2(direction.x, direction.z);
    rig.status?.color.set(contact.connected ? '#9bbcb0' : '#e74e30');
    rig.status?.emissive.set(contact.connected ? '#61b693' : '#e74e30');
    drum.set(rig.side * 0.62, 1.13, -6.11);
    body.localToWorld(drum);
    ropeDirection.copy(head).addScaledVector(direction, -0.18).sub(drum);
    rig.rope.position.copy(drum);
    rig.rope.scale.set(1, ropeDirection.length(), 1);
    rig.rope.quaternion.setFromUnitVectors(UP, ropeDirection.normalize());
  }

  function update(snapshot: VehicleSnapshot, selected: boolean, elapsed: number) {
    last = { snapshot, selected, elapsed };
    if (!bound || disposed) return;
    chassis.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
    chassis.rotation.y = snapshot.yaw;
    suspension.rotation.set(snapshot.pitchAngle, 0, snapshot.rollAngle);
    body.updateWorldMatrix(true, false);
    for (const wheel of wheels) {
      wheel.steer.rotation.y = wheel.front ? snapshot.steeringAngle : 0;
      wheel.spin.rotation.x = snapshot.totalDistance / WHEEL_RADIUS;
    }
    for (const door of doors) door.pivot.rotation.y = door.direction * snapshot.doorOpen * 1.42;
    selection.visible = selected;
    selectionMaterial.opacity = 0.68 + Math.sin(elapsed * 1.8) * 0.12;
    for (const material of brakes)
      material.emissiveIntensity = snapshot.acceleration < -0.15 ? 1.7 : 0.4;
    snapshot.poles.forEach((contact, index) => updatePole(poles[index], contact));
  }

  const ready = lease.scene.then((source) => {
    if (disposed) return;
    model = source.clone(true);
    const clones = new Map<THREE.Material, THREE.Material>();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const cloneMaterial = (original: THREE.Material) => {
        let material = clones.get(original);
        if (!material) {
          material = original.clone();
          clones.set(original, material);
          materials.add(material);
          if (material instanceof THREE.MeshStandardMaterial) {
            material.envMap = currentEnvironment ?? null;
            material.envMapIntensity = 0.35;
            if (material.name === 'review-brake-lamp') brakes.push(material);
          }
          if (material.transparent) {
            material.depthWrite = false;
            material.side = THREE.DoubleSide;
            material.forceSinglePass = true;
          }
        }
        return material;
      };
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material);
      const list = Array.isArray(object.material) ? object.material : [object.material];
      object.castShadow = !list.some((material) => material.transparent);
      object.receiveShadow = true;
    });
    const requireNode = (name: string) => {
      const node = model!.getObjectByName(name);
      if (!node) throw new Error(`Blender vehicle is missing required pivot: ${name}`);
      return node;
    };
    chassis = requireNode('chassis');
    suspension = requireNode('body-suspension');
    body = requireNode('body-shell');
    wheels = ['front', 'rear'].flatMap((axle) =>
      ['left', 'right'].map((side) => ({
        steer: requireNode(`wheel-steer-${axle}-${side}`),
        spin: requireNode(`wheel-spin-${axle}-${side}`),
        front: axle === 'front',
      })),
    );
    doors = ['front', 'middle', 'rear'].flatMap((door) =>
      ['forward', 'rearward'].map((leaf) => ({
        pivot: requireNode(`door-${door}-${leaf}-pivot`),
        direction: leaf === 'forward' ? -1 : 1,
      })),
    );
    poles = ['left', 'right'].map((side, index) => {
      const head = requireNode(`pole-${side}-contact-head`);
      let status: THREE.MeshStandardMaterial | undefined;
      head.traverse((object) => {
        if (
          object instanceof THREE.Mesh &&
          object.material instanceof THREE.MeshStandardMaterial &&
          object.material.name === 'review-contact-status'
        ) {
          status = object.material.clone();
          materials.add(status);
          object.material = status;
        }
      });
      return {
        aim: requireNode(`pole-${side}-aim`),
        lower: requireNode(`pole-${side}-shaft-lower`),
        upper: requireNode(`pole-${side}-shaft-upper`),
        head,
        rope: requireNode(`pole-${side}-retrieval-rope`),
        side: index === 0 ? -1 : 1,
        status,
      };
    });
    group.add(model);
    chassis.add(selection);
    bound = true;
    if (last) update(last.snapshot, last.selected, last.elapsed);
  });
  return {
    group,
    ready,
    update,
    setEnvironment(texture) {
      currentEnvironment = texture;
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMap = texture;
          material.needsUpdate = true;
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      materials.forEach((material) => material.dispose());
      selection.geometry.dispose();
      selectionMaterial.dispose();
      lease.release();
      group.clear();
    },
  };
}
