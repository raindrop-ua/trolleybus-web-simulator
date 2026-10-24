import { describe, expect, it } from 'vitest';
import { distance3 } from '../core/math/vector';
import { createWorldDefinition } from '../data/world';
import { selectActuatedBranch, selectRouteBranch } from '../domain/overhead/ContactSwitch';
import { calculatePoleBase, solvePoleContact } from '../domain/overhead/PoleContactSolver';
import type { Polarity } from '../domain/types';

const world = createWorldDefinition();

describe('directed arc-length road graph', () => {
  it('wraps distance and joins every segment continuously', () => {
    expect(
      distance3(world.road.sample(0).position, world.road.sample(world.road.length).position),
    ).toBeLessThan(1e-8);
    expect(
      distance3(world.road.sample(-5).position, world.road.sample(world.road.length - 5).position),
    ).toBeLessThan(1e-8);
    for (const segment of world.road.segments) {
      const before = world.road.sample(segment.startDistance - 0.0001);
      const after = world.road.sample(segment.startDistance + 0.0001);
      expect(distance3(before.position, after.position)).toBeLessThan(0.0003);
      expect(distance3(before.tangent, after.tangent)).toBeLessThan(0.001);
      expect(segment.nextSegmentIds).toHaveLength(1);
    }
  });

  it('moves approximately one metre per metre sampled, including curves', () => {
    for (let distance = 0; distance < world.road.length; distance += 0.5) {
      expect(
        distance3(world.road.sample(distance).position, world.road.sample(distance + 0.1).position),
      ).toBeCloseTo(0.1, 3);
    }
  });

  it('configures five ordered visits per direction and exactly three fleet numbers', () => {
    expect(world.stops).toHaveLength(10);
    expect(world.stops.filter((stop) => stop.direction === 'outbound')).toHaveLength(5);
    expect(world.stops.filter((stop) => stop.direction === 'inbound')).toHaveLength(5);
    expect(world.stops.map((stop) => stop.distance)).toEqual(
      world.stops.map((stop) => stop.distance).sort((a, b) => a - b),
    );
    expect(world.vehicles.map((vehicle) => vehicle.id)).toEqual(['2001', '2002', '2003']);
    expect(new Set(world.stops.map((stop) => stop.physicalId)).size).toBe(5);
  });

  it('keeps full vehicle footprints apart across opposing lanes and terminal necks', () => {
    const samples = Array.from({ length: Math.ceil(world.road.length / 0.5) }, (_, index) => {
      const distance = index * 0.5;
      const sample = world.road.sample(distance);
      return {
        distance,
        position: sample.position,
        forward: sample.tangent,
        right: { x: Math.cos(sample.yaw), z: -Math.sin(sample.yaw) },
      };
    });
    const halfLength = world.vehicles[0]!.length / 2;
    const halfWidth = world.vehicles[0]!.width / 2;
    for (let index = 0; index < samples.length; index += 1) {
      const a = samples[index]!;
      for (let next = index + 1; next < samples.length; next += 1) {
        const b = samples[next]!;
        const routeGap = Math.min(
          b.distance - a.distance,
          world.road.length - b.distance + a.distance,
        );
        if (routeGap < 18 || distance3(a.position, b.position) > 13) continue;
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const separated = [a.forward, a.right, b.forward, b.right].some((axis) => {
          const projectedA =
            halfLength * Math.abs(a.forward.x * axis.x + a.forward.z * axis.z) +
            halfWidth * Math.abs(a.right.x * axis.x + a.right.z * axis.z);
          const projectedB =
            halfLength * Math.abs(b.forward.x * axis.x + b.forward.z * axis.z) +
            halfWidth * Math.abs(b.right.x * axis.x + b.right.z * axis.z);
          return Math.abs(dx * axis.x + dz * axis.z) > projectedA + projectedB;
        });
        expect(
          separated,
          `12m bus footprints overlap at route distances ${a.distance}m and ${b.distance}m`,
        ).toBe(true);
      }
    }
  });
});

describe('paired overhead contact network', () => {
  it('samples both wires by their independent geometric arc lengths', () => {
    expect(world.contact.wireLength!('positive')).not.toBeCloseTo(
      world.contact.wireLength!('negative'),
      1,
    );
    for (const polarity of ['negative', 'positive'] as Polarity[]) {
      const length = world.contact.wireLength!(polarity);
      expect(
        distance3(
          world.contact.sample(0, polarity).position,
          world.contact.sample(length, polarity).position,
        ),
      ).toBeLessThan(1e-8);
      for (let distance = 0; distance < length; distance += 0.5) {
        expect(
          distance3(
            world.contact.sample(distance, polarity).position,
            world.contact.sample(distance + 0.1, polarity).position,
          ),
        ).toBeCloseTo(0.1, 3);
      }
    }
  });

  it('sweeps both poles through two complete routes, with suspension and graph transitions', () => {
    for (const polarity of ['negative', 'positive'] as Polarity[]) {
      let previous: number | undefined;
      let previousHead: { x: number; y: number; z: number } | undefined;
      const visitedSegments = new Set<string>();
      for (let distance = 0; distance < world.road.length * 2; distance += 0.18) {
        const road = world.road.sample(distance);
        const roll = Math.sin(distance * 0.05) * 0.04;
        const pitch = Math.cos(distance * 0.06) * 0.03;
        const base = calculatePoleBase(
          road.position,
          road.yaw,
          polarity === 'positive' ? 1 : -1,
          roll,
          pitch,
        );
        const contact = solvePoleContact(world.contact, base, 7.8, distance, polarity, previous);
        expect(
          contact.connected,
          `${polarity} disconnected at ${distance.toFixed(2)}m: ${contact.diagnostic}`,
        ).toBe(true);
        expect(contact.lengthError).toBeLessThan(0.01);
        expect(contact.wireError).toBeLessThan(0.01);
        expect(
          distance3(contact.head, world.contact.sample(contact.wireDistance, polarity).position),
        ).toBeLessThan(1e-8);
        if (previousHead) expect(distance3(contact.head, previousHead)).toBeLessThan(0.22);
        if (previous !== undefined)
          expect(Math.abs(contact.wireDistance - previous)).toBeLessThan(0.22);
        previous = contact.wireDistance;
        previousHead = contact.head;
        visitedSegments.add(contact.wireSegmentId);
      }
      expect(visitedSegments.size).toBe(
        world.contact.segments.filter(
          (segment) => segment.polarity === polarity && !segment.id.includes('branch'),
        ).length,
      );
    }
  });

  it('defines paired, diverging switch geometry and explicit route selection', () => {
    expect(world.contact.switches).toHaveLength(2);
    for (const contactSwitch of world.contact.switches) {
      const incoming = world.contact.segments.find(
        (segment) => segment.id === contactSwitch.incomingSegmentId,
      )!;
      expect(incoming.nextSegmentIds).toEqual(contactSwitch.outgoingSegmentIds);
      expect(selectRouteBranch(contactSwitch)).toBe(contactSwitch.routeBranchId);
      expect(selectActuatedBranch(contactSwitch, false)).toBe(contactSwitch.routeBranchId);
      expect(selectActuatedBranch(contactSwitch, true)).not.toBe(contactSwitch.routeBranchId);
      const direct = world.contact.segments.find(
        (segment) => segment.id === contactSwitch.routeBranchId,
      )!;
      const branch = world.contact.segments.find(
        (segment) => segment.id === selectActuatedBranch(contactSwitch, true),
      )!;
      expect(branch.startNodeId).toBe(direct.startNodeId);
      expect(
        distance3(
          world.contact.sampleBranch!(direct.id, 0).position,
          world.contact.sampleBranch!(branch.id, 0).position,
        ),
      ).toBeLessThan(1e-7);
      expect(
        distance3(
          world.contact.sampleBranch!(direct.id, direct.length).position,
          world.contact.sampleBranch!(branch.id, branch.length).position,
        ),
      ).toBeLessThan(1e-6);
      expect(
        distance3(
          world.contact.sampleBranch!(direct.id, direct.length / 2).position,
          world.contact.sampleBranch!(branch.id, branch.length / 2).position,
        ),
      ).toBeGreaterThan(5);
    }
  });

  it('preserves the continuous pole solution when a wrapped route coordinate crosses zero', () => {
    const beforeDistance = world.road.length - 0.001;
    const beforeRoad = world.road.sample(beforeDistance);
    const before = solvePoleContact(
      world.contact,
      calculatePoleBase(beforeRoad.position, beforeRoad.yaw, 1),
      7.8,
      beforeDistance,
      'positive',
    );
    const afterRoad = world.road.sample(0.001);
    const after = solvePoleContact(
      world.contact,
      calculatePoleBase(afterRoad.position, afterRoad.yaw, 1),
      7.8,
      0.001,
      'positive',
      before.wireDistance,
    );
    expect(before.connected && after.connected).toBe(true);
    expect(distance3(before.head, after.head)).toBeLessThan(0.0022);
    expect(after.wireDistance - before.wireDistance).toBeGreaterThan(0);
    expect(after.wireDistance - before.wireDistance).toBeLessThan(0.0022);
  });

  it('reports impossible contact without changing the fixed pole length', () => {
    const sample = world.road.sample(100);
    const base = calculatePoleBase(
      { x: sample.position.x, y: -20, z: sample.position.z },
      sample.yaw,
      1,
    );
    const contact = solvePoleContact(world.contact, base, 7.8, 100, 'positive');
    expect(contact.connected).toBe(false);
    expect(contact.diagnostic).toContain('No reachable');
    expect(distance3(contact.base, contact.head)).toBeCloseTo(7.8, 8);
    expect(contact.wireError).toBeGreaterThan(1);
  });

  it('rejects geometrically reachable contact outside elevation and slew limits', () => {
    const road = world.road.sample(100);
    const base = calculatePoleBase(road.position, road.yaw, 1);
    const lowWireAngle = solvePoleContact(world.contact, { ...base, y: 6.2 }, 7.8, 100, 'positive');
    expect(lowWireAngle.connected).toBe(false);
    expect(lowWireAngle.diagnostic).toContain('articulation');
    const limitedSlew = solvePoleContact(world.contact, base, 7.8, 100, 'positive', undefined, {
      minimumElevation: 0,
      maximumElevation: Math.PI / 2,
      maximumHorizontalSlew: 0,
    });
    expect(limitedSlew.connected).toBe(false);
    expect(limitedSlew.diagnostic).toContain('articulation');
    expect(lowWireAngle.lengthError).toBeLessThan(0.01);
    expect(limitedSlew.lengthError).toBeLessThan(0.01);
  });
});
