import * as THREE from 'three';
import type { VehicleSnapshot, WorldDefinition } from '../../domain/types';
import { material, rod } from '../environment/primitives';

export class OverheadScene {
  readonly group = new THREE.Group();
  readonly debug = new THREE.Group();
  private markers: THREE.Mesh[] = [];
  private reach: THREE.Mesh[] = [];
  constructor(private world: WorldDefinition) {
    const steel = material('#536963');
    const wireMaterial = new THREE.LineBasicMaterial({
      color: '#526660',
      transparent: true,
      opacity: 0.72,
    });
    const debugMaterial = new THREE.LineBasicMaterial({ color: '#ed8a38', depthTest: false });
    for (const polarity of ['positive', 'negative'] as const) {
      const length = world.contact.wireLength?.(polarity) ?? world.contact.length;
      const count = Math.ceil(length * 2) + 1;
      const points = Array.from({ length: count }, (_, i) => {
        const p = world.contact.sample((i / (count - 1)) * length, polarity).position;
        return new THREE.Vector3(p.x, p.y, p.z);
      });
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this.group.add(new THREE.Line(geo, wireMaterial));
      const debugLine = new THREE.Line(geo, debugMaterial);
      debugLine.renderOrder = 20;
      this.debug.add(debugLine);
    }
    for (const segment of world.contact.segments.filter((s) => s.id.includes('branch'))) {
      if (!world.contact.sampleBranch) continue;
      const points = Array.from({ length: 65 }, (_, i) => {
        const p = world.contact.sampleBranch!(segment.id, (i / 64) * segment.length).position;
        return new THREE.Vector3(p.x, p.y, p.z);
      });
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this.group.add(new THREE.Line(geo, wireMaterial));
      this.debug.add(new THREE.Line(geo, debugMaterial));
    }
    for (let d = 0; d < world.road.length; d += 25) {
      const sample = world.road.sample(d),
        p = sample.position,
        t = sample.tangent;
      const base = new THREE.Vector3(p.x - t.z * 6.7, 0, p.z + t.x * 6.7);
      const top = base.clone().setY(8.5);
      rod(this.group, base, top, 0.12, steel);
      const arm = new THREE.Vector3(p.x + t.z * 0.8, 7.4, p.z - t.x * 0.8);
      rod(this.group, top, arm, 0.065, steel);
      const routeDistance = world.contact.routeToWireDistance?.(d, 'positive') ?? d;
      const wire = world.contact.sample(routeDistance, 'positive').position;
      rod(this.group, arm, new THREE.Vector3(wire.x, wire.y, wire.z), 0.025, steel);
      const negativeDistance = world.contact.routeToWireDistance?.(d, 'negative') ?? d;
      const otherWire = world.contact.sample(negativeDistance, 'negative').position;
      rod(this.group, arm, new THREE.Vector3(otherWire.x, otherWire.y, otherWire.z), 0.025, steel);
    }
    const nodeGeometry = new THREE.SphereGeometry(0.22, 7, 5);
    const nodeMaterial = new THREE.MeshBasicMaterial({ color: '#f1bc62', depthTest: false });
    for (const segment of world.contact.segments) {
      const p =
        world.contact.sampleBranch?.(segment.id, 0).position ??
        world.contact.sample(segment.startDistance, segment.polarity).position;
      const node = new THREE.Mesh(nodeGeometry, nodeMaterial);
      node.position.copy(p);
      this.debug.add(node);
    }
    for (let i = 0; i < 6; i++) {
      const base = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 8, 6),
        new THREE.MeshBasicMaterial({ color: '#eb923b', depthTest: false }),
      );
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 8, 6),
        new THREE.MeshBasicMaterial({ color: '#75edc8', depthTest: false }),
      );
      this.markers.push(base, head);
      this.debug.add(base, head);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1, 16, 12),
        new THREE.MeshBasicMaterial({
          color: '#37b8a6',
          wireframe: true,
          transparent: true,
          opacity: 0.1,
          depthWrite: false,
        }),
      );
      this.reach.push(sphere);
      this.debug.add(sphere);
    }
    this.debug.visible = false;
    this.group.add(this.debug);
  }
  update(vehicles: VehicleSnapshot[], debug: boolean) {
    this.debug.visible = debug;
    if (!debug) return;
    vehicles.forEach((vehicle, vi) =>
      vehicle.poles.forEach((pole, pi) => {
        const index = vi * 2 + pi;
        this.markers[index * 2].position.copy(pole.base);
        this.markers[index * 2 + 1].position.copy(pole.head);
        this.reach[index].position.copy(pole.base);
        this.reach[index].scale.setScalar(this.world.vehicles[vi].poleLength);
      }),
    );
  }
}
