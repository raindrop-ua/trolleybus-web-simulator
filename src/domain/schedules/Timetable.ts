import type { RoadPath, StopDefinition, VehicleConfiguration } from '../types';
import { AutonomousDriver } from '../driving/AutonomousDriver';
import { createDynamicsState, integrateVehicleDynamics } from '../vehicles/VehicleDynamics';
import { observeRoad } from '../driving/RoadAwareness';

export const DOOR_TRANSITION_SECONDS = 1.1;
export const clampDwell = (seconds: number): number => Math.max(8, Math.min(20, seconds));

/** Timetable baselines use an unimpeded, reproducible run of the same driver and dynamics. */
export class Timetable {
  private readonly travelTimes = new Map<string, number>();

  constructor(private readonly road: RoadPath) {}

  travelTime(startDistance: number, endDistance: number, vehicle: VehicleConfiguration): number {
    const normalizedStart =
      ((startDistance % this.road.length) + this.road.length) % this.road.length;
    const distance = endDistance - startDistance;
    const key = `${vehicle.maxSpeed}:${vehicle.acceleration}:${vehicle.braking}:${vehicle.wheelbase}:${normalizedStart.toFixed(3)}:${distance.toFixed(3)}`;
    const cached = this.travelTimes.get(key);
    if (cached !== undefined) return cached;
    const driver = new AutonomousDriver();
    const state = createDynamicsState();
    const dt = 1 / 30;
    let position = startDistance;
    let elapsed = 0;
    while (elapsed < 3600) {
      const awareness = observeRoad(this.road, position, state.speed, vehicle.maxSpeed);
      const remaining = endDistance - position;
      if (remaining <= 0.35 && state.speed === 0) break;
      const command = driver.update(
        {
          configuration: vehicle,
          speed: state.speed,
          ...awareness,
          distanceToStop: remaining,
          mayDepart: true,
          leader: null,
        },
        dt,
      );
      position += integrateVehicleDynamics(state, command, vehicle, awareness.curvature, dt);
      elapsed += dt;
    }
    if (elapsed >= 3600)
      throw new Error('Timetable could not reach the next stop; check route geometry.');
    this.travelTimes.set(key, elapsed);
    return elapsed;
  }

  departureTime(arrivalTime: number, stop: StopDefinition): number {
    return arrivalTime + clampDwell(stop.dwellSeconds) + 2 * DOOR_TRANSITION_SECONDS;
  }
}
