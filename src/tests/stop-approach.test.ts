import { describe, expect, it } from 'vitest';
import { createWorldDefinition } from '../data/world';
import { StopApproachPath, STOP_CURB_OFFSET } from '../domain/roads/StopApproachPath';
import { SimulationEngine } from '../simulation/SimulationEngine';

describe('curb approaches independent of the overhead network', () => {
  it('berths beside the curb, keeps entry/exit continuous and preserves the reference road and wires', () => {
    const world = createWorldDefinition();
    const baseline = world.stops.map((s) => ({
      road: world.road.sample(s.distance),
      wire: world.contact.sample(s.distance, 'negative'),
    }));
    const path = new StopApproachPath(world.road, world.stops);
    for (const [index, stop] of world.stops.entries()) {
      const road = world.road.sample(stop.distance),
        berth = path.sample(stop.distance);
      expect(path.lateralOffset(stop.distance)).toBe(STOP_CURB_OFFSET);
      expect(
        (berth.position.x - road.position.x) * Math.cos(road.yaw) -
          (berth.position.z - road.position.z) * Math.sin(road.yaw),
      ).toBeCloseTo(STOP_CURB_OFFSET, 8);
      expect(berth.yaw).toBeCloseTo(road.yaw, 3);
      expect(world.road.sample(stop.distance)).toEqual(baseline[index]!.road);
      expect(world.contact.sample(stop.distance, 'negative')).toEqual(baseline[index]!.wire);
    }
    let maximumPositionStep = 0,
      maximumYawStep = 0;
    for (let distance = 0; distance < path.length; distance += 0.1) {
      const a = path.sample(distance),
        b = path.sample(distance + 0.1);
      maximumPositionStep = Math.max(
        maximumPositionStep,
        Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z),
      );
      maximumYawStep = Math.max(
        maximumYawStep,
        Math.abs(Math.atan2(Math.sin(a.yaw - b.yaw), Math.cos(a.yaw - b.yaw))),
      );
      expect(a.lateralOffset).toBeGreaterThanOrEqual(STOP_CURB_OFFSET);
      expect(a.lateralOffset).toBeLessThanOrEqual(0);
    }
    expect(maximumPositionStep).toBeLessThan(0.13);
    expect(maximumYawStep).toBeLessThan(0.04);
  });

  it('keeps the wheels off the raised curb and the 12 m body clear of platform furniture', () => {
    const world = createWorldDefinition(),
      path = new StopApproachPath(world.road, world.stops);
    let minimumClearance = Infinity;
    let wheelClearance = Infinity;
    for (const stop of world.stops) {
      const berth = world.road.sample(stop.distance);
      for (let d = -14; d <= 14; d += 0.1) {
        const pose = path.sample(stop.distance + d);
        for (const x of [-1.275, 1.275])
          for (const z of [-6, 6]) {
            const px =
              pose.position.x + Math.cos(pose.yaw) * x + Math.sin(pose.yaw) * z - berth.position.x;
            const pz =
              pose.position.z - Math.sin(pose.yaw) * x + Math.cos(pose.yaw) * z - berth.position.z;
            const across = px * Math.cos(berth.yaw) - pz * Math.sin(berth.yaw);
            const along = px * Math.sin(berth.yaw) + pz * Math.cos(berth.yaw);
            if (along >= -10.1 && along <= 8.9)
              minimumClearance = Math.min(minimumClearance, across + 4.95);
          }
        for (const side of [-1, 1])
          for (const axle of [3.1, -2.9])
            for (const x of [-0.15, 0.15])
              for (const z of [-0.49, 0.49]) {
                const steer = axle > 0 ? Math.atan(6 * pose.curvature) : 0;
                const wx = side * 1.12 + Math.cos(steer) * x + Math.sin(steer) * z;
                const wz = axle - Math.sin(steer) * x + Math.cos(steer) * z;
                const px =
                  pose.position.x +
                  Math.cos(pose.yaw) * wx +
                  Math.sin(pose.yaw) * wz -
                  berth.position.x;
                const pz =
                  pose.position.z -
                  Math.sin(pose.yaw) * wx +
                  Math.cos(pose.yaw) * wz -
                  berth.position.z;
                const across = px * Math.cos(berth.yaw) - pz * Math.sin(berth.yaw);
                const along = px * Math.sin(berth.yaw) + pz * Math.cos(berth.yaw);
                if (along >= -10.1 && along <= 8.9)
                  wheelClearance = Math.min(wheelClearance, across + 4.06);
              }
      }
    }
    expect(minimumClearance).toBeGreaterThan(0.18);
    expect(wheelClearance).toBeGreaterThan(0.1);
  });

  it('uses the actual offset pose for pole bases and never slides sideways during boarding', () => {
    const world = createWorldDefinition();
    const engine = new SimulationEngine(world);
    let boarded = 0,
      previous = engine.snapshot();
    for (let tick = 0; tick < 60 * 220; tick++) {
      engine.step();
      const snapshot = engine.snapshot();
      for (const [index, vehicle] of snapshot.vehicles.entries()) {
        expect(vehicle.poles.every((p) => p.connected)).toBe(true);
        if (vehicle.doorOpen <= 0) continue;
        boarded++;
        const road = world.road.sample(vehicle.distanceAlongRoute);
        const offset =
          (vehicle.position.x - road.position.x) * Math.cos(road.yaw) -
          (vehicle.position.z - road.position.z) * Math.sin(road.yaw);
        expect(offset).toBeCloseTo(STOP_CURB_OFFSET, 8);
        expect(vehicle.position).toEqual(previous.vehicles[index]!.position);
        expect(vehicle.speed).toBe(0);
        for (const pole of vehicle.poles) expect(pole.lengthError).toBeLessThan(0.001);
      }
      previous = snapshot;
    }
    expect(boarded).toBeGreaterThan(100);
  });
});
