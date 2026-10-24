import { expect, it } from 'vitest';
import { createWorldDefinition } from '../data/world';
import type { VehicleSnapshot } from '../domain/types';
import { SimulationEngine } from '../simulation/SimulationEngine';

/** Separating-axis test for actual oriented 12 × 2.55 m vehicle footprints. */
function bodyOverlap(a: VehicleSnapshot, b: VehicleSnapshot): boolean {
  const axes = [
    { x: Math.sin(a.yaw), z: Math.cos(a.yaw) },
    { x: Math.cos(a.yaw), z: -Math.sin(a.yaw) },
    { x: Math.sin(b.yaw), z: Math.cos(b.yaw) },
    { x: Math.cos(b.yaw), z: -Math.sin(b.yaw) },
  ];
  const dx = b.position.x - a.position.x;
  const dz = b.position.z - a.position.z;
  return axes.every((axis) => {
    const aRadius =
      6 * Math.abs(axis.x * Math.sin(a.yaw) + axis.z * Math.cos(a.yaw)) +
      1.275 * Math.abs(axis.x * Math.cos(a.yaw) - axis.z * Math.sin(a.yaw));
    const bRadius =
      6 * Math.abs(axis.x * Math.sin(b.yaw) + axis.z * Math.cos(b.yaw)) +
      1.275 * Math.abs(axis.x * Math.cos(b.yaw) - axis.z * Math.sin(b.yaw));
    return Math.abs(dx * axis.x + dz * axis.z) < aRadius + bRadius;
  });
}

it('verifies every 60 Hz pole step, door and physical body footprint through three complete round trips per vehicle', () => {
  const world = createWorldDefinition();
  const engine = new SimulationEngine(world, 6);
  let previous = engine.snapshot();
  let maxLengthError = 0;
  let maxWireError = 0;
  let maxHeadMovement = 0;
  let maxStopMiss = 0;
  let minCenterDistance = Infinity;
  let movingDoorFrames = 0;
  let openDoorFrames = 0;
  let bodyCollisions = 0;
  let completed = false;

  for (let tick = 0; tick < 60 * 1800; tick += 1) {
    engine.step();
    const snapshot = engine.snapshot();
    for (let index = 0; index < snapshot.vehicles.length; index += 1) {
      const vehicle = snapshot.vehicles[index]!;
      const previousVehicle = previous.vehicles[index]!;
      for (let poleIndex = 0; poleIndex < 2; poleIndex += 1) {
        const pole = vehicle.poles[poleIndex]!;
        const previousPole = previousVehicle.poles[poleIndex]!;
        maxLengthError = Math.max(maxLengthError, pole.lengthError);
        maxWireError = Math.max(maxWireError, pole.wireError);
        maxHeadMovement = Math.max(
          maxHeadMovement,
          Math.hypot(
            pole.head.x - previousPole.head.x,
            pole.head.y - previousPole.head.y,
            pole.head.z - previousPole.head.z,
          ),
        );
        if (!pole.connected)
          throw new Error(`${vehicle.id}: contact lost at ${snapshot.elapsed.toFixed(3)}s`);
      }
      if (vehicle.doorOpen > 0) {
        openDoorFrames += 1;
        if (vehicle.speed !== 0) movingDoorFrames += 1;
      }
      if (vehicle.currentStopId) {
        const stop = world.stops.find((item) => item.id === vehicle.currentStopId)!;
        const miss = Math.abs(
          ((stop.distance - vehicle.distanceAlongRoute + world.road.length * 1.5) %
            world.road.length) -
            world.road.length / 2,
        );
        maxStopMiss = Math.max(maxStopMiss, miss);
      }
      for (let otherIndex = index + 1; otherIndex < snapshot.vehicles.length; otherIndex += 1) {
        const other = snapshot.vehicles[otherIndex]!;
        minCenterDistance = Math.min(
          minCenterDistance,
          Math.hypot(vehicle.position.x - other.position.x, vehicle.position.z - other.position.z),
        );
        if (bodyOverlap(vehicle, other)) bodyCollisions += 1;
      }
    }
    previous = snapshot;
    if (snapshot.vehicles.every((vehicle) => vehicle.completedLaps >= 3)) {
      completed = true;
      break;
    }
  }

  const snapshot = engine.snapshot();
  const stopVisitCounts = snapshot.vehicles.map((vehicle) => {
    const arrivals = snapshot.stopEvents.filter(
      (event) => event.vehicleId === vehicle.id && event.kind === 'arrival',
    );
    const counts = world.stops.map(
      (stop) => arrivals.filter((event) => event.stopId === stop.id).length,
    );
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(3);
    return {
      id: vehicle.id,
      arrivals: arrivals.length,
      minimumVisitsPerStop: Math.min(...counts),
      delaySeconds: vehicle.scheduleDeviationSeconds,
    };
  });
  expect(completed).toBe(true);
  expect(snapshot.diagnostics).toHaveLength(0);
  expect(maxLengthError).toBeLessThan(0.01);
  expect(maxWireError).toBeLessThan(0.01);
  expect(maxHeadMovement).toBeLessThan(0.35);
  expect(maxStopMiss).toBeLessThan(0.35);
  expect(openDoorFrames).toBeGreaterThan(0);
  expect(movingDoorFrames).toBe(0);
  expect(bodyCollisions).toBe(0);
  console.info(
    'Three-round-trip verification:',
    JSON.stringify({
      elapsed: snapshot.elapsed,
      maxLengthError,
      maxWireError,
      maxHeadMovement,
      maxStopMiss,
      minCenterDistance,
      movingDoorFrames,
      bodyCollisions,
      vehicles: stopVisitCounts,
    }),
  );
}, 120_000);
