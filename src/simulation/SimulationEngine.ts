import type {
  DiagnosticEvent,
  OperationalState,
  PoleContact,
  SimulationSnapshot,
  StopDefinition,
  StopEvent,
  VehicleConfiguration,
  VehicleSnapshot,
  WorldDefinition,
} from '../domain/types';
import { AutonomousDriver } from '../domain/driving/AutonomousDriver';
import type { DrivingController } from '../domain/driving/DrivingController';
import { observeRoad } from '../domain/driving/RoadAwareness';
import { calculatePoleBase, solvePoleContact } from '../domain/overhead/PoleContactSolver';
import { clampDwell, DOOR_TRANSITION_SECONDS, Timetable } from '../domain/schedules/Timetable';
import {
  createDynamicsState,
  integrateVehicleDynamics,
  type DynamicsState,
} from '../domain/vehicles/VehicleDynamics';
import { SeededRandom } from './SeededRandom';
import { SimulationClock } from './SimulationClock';

interface VehicleRuntime {
  configuration: VehicleConfiguration;
  controller: DrivingController;
  dynamics: DynamicsState;
  initialDistance: number;
  totalDistance: number;
  nextStopIndex: number;
  nextStopDistance: number;
  currentStopId: string | null;
  state: OperationalState;
  doorOpen: number;
  phaseElapsed: number;
  dwellSeconds: number;
  releaseAt: number;
  plannedArrival: number;
  plannedDeparture: number;
  deviation: number;
  passengers: number;
  poles: [PoleContact, PoleContact];
}

const wrap = (distance: number, length: number): number => ((distance % length) + length) % length;
const clonePole = (pole: PoleContact): PoleContact => ({
  ...pole,
  base: { ...pole.base },
  head: { ...pole.head },
});

/** Coordinates domain systems. It deliberately has no renderer, state-store, or browser imports. */
export class SimulationEngine {
  private clock = new SimulationClock();
  private random: SeededRandom;
  private readonly timetable: Timetable;
  private readonly stops: StopDefinition[];
  private vehicles: VehicleRuntime[] = [];
  private elapsed = 0;
  private paused = false;
  private seed: number;
  private stopEvents: StopEvent[] = [];
  private diagnostics: DiagnosticEvent[] = [];

  constructor(
    private readonly world: WorldDefinition,
    seed = 6,
    private readonly createController: (
      configuration: VehicleConfiguration,
    ) => DrivingController = () => new AutonomousDriver(),
  ) {
    if (world.road.length <= 0 || world.stops.length === 0)
      throw new Error('Simulation needs a route with stops.');
    this.seed = seed;
    this.random = new SeededRandom(seed);
    this.timetable = new Timetable(world.road);
    this.stops = [...world.stops].sort((left, right) => left.distance - right.distance);
    this.initializeVehicles();
  }

  setPaused(paused: boolean): void {
    if (this.paused === paused) return;
    this.paused = paused;
    this.clock.setPaused(paused);
  }

  setSpeed(speed: 1 | 2 | 4): void {
    this.clock.setSpeed(speed);
  }

  reset(seed = this.seed): void {
    this.seed = seed;
    this.random = new SeededRandom(seed);
    this.clock = new SimulationClock();
    this.elapsed = 0;
    this.paused = false;
    this.stopEvents = [];
    this.diagnostics = [];
    this.initializeVehicles();
  }

  advance(realDeltaSeconds: number): void {
    this.clock.advance(realDeltaSeconds, (dt) => this.step(dt));
  }

  step(dt = SimulationClock.timestep): void {
    if (this.paused) return;
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1)
      throw new Error('Simulation step must be between 0 and 0.1 seconds.');
    // All following decisions read the same previous tick, avoiding update-order advantage.
    const leaders = this.vehicles.map((vehicle) => this.findLeader(vehicle));
    this.elapsed += dt;
    this.vehicles.forEach((vehicle, index) => {
      const awareness = observeRoad(
        this.world.road,
        vehicle.totalDistance,
        vehicle.dynamics.speed,
        vehicle.configuration.maxSpeed,
      );
      if (vehicle.state === 'disconnected') {
        // The emergency brake obeys the same finite acceleration/jerk limits as normal driving.
        vehicle.totalDistance += integrateVehicleDynamics(
          vehicle.dynamics,
          { traction: 0, braking: 1, steering: 0, doorsRequestedOpen: false },
          vehicle.configuration,
          awareness.curvature,
          dt,
        );
        this.updateContacts(vehicle);
        return;
      }
      const mayDepart =
        (vehicle.state === 'driving' || vehicle.state === 'braking') &&
        this.elapsed >= vehicle.releaseAt;
      const command = vehicle.controller.update(
        {
          configuration: vehicle.configuration,
          speed: vehicle.dynamics.speed,
          ...awareness,
          distanceToStop: vehicle.nextStopDistance - vehicle.totalDistance,
          mayDepart,
          leader: leaders[index] ?? null,
        },
        dt,
      );
      const movement = integrateVehicleDynamics(
        vehicle.dynamics,
        command,
        vehicle.configuration,
        awareness.curvature,
        dt,
      );
      vehicle.totalDistance += movement;

      if (vehicle.state === 'waiting' && this.elapsed >= vehicle.releaseAt)
        vehicle.state = 'driving';
      if (vehicle.state === 'driving' || vehicle.state === 'braking') {
        vehicle.state = vehicle.dynamics.acceleration < -0.15 ? 'braking' : 'driving';
        if (
          command.doorsRequestedOpen &&
          vehicle.nextStopDistance - vehicle.totalDistance <= 0.35 &&
          vehicle.dynamics.speed === 0
        )
          this.arrive(vehicle);
      } else if (vehicle.state !== 'waiting') {
        this.updateStopOperation(vehicle, dt);
      }
      this.updateContacts(vehicle);
    });
  }

  snapshot(): SimulationSnapshot {
    return {
      time: this.world.startTime + this.elapsed,
      elapsed: this.elapsed,
      vehicles: this.vehicles.map((vehicle): VehicleSnapshot => {
        const distanceAlongRoute = wrap(vehicle.totalDistance, this.world.road.length);
        const sample = this.world.road.sample(distanceAlongRoute);
        return {
          id: vehicle.configuration.id,
          distanceAlongRoute,
          totalDistance: vehicle.totalDistance,
          position: { ...sample.position },
          yaw: sample.yaw,
          speed: vehicle.dynamics.speed,
          acceleration: vehicle.dynamics.acceleration,
          steeringAngle: vehicle.dynamics.steeringAngle,
          rollAngle: vehicle.dynamics.rollAngle,
          pitchAngle: vehicle.dynamics.pitchAngle,
          doorOpen: vehicle.doorOpen,
          operationalState: vehicle.state,
          currentStopId: vehicle.currentStopId,
          nextStopId: this.stops[vehicle.nextStopIndex]!.id,
          scheduleDeviationSeconds: vehicle.deviation,
          passengers: vehicle.passengers,
          completedLaps: Math.floor(
            (vehicle.totalDistance - vehicle.initialDistance) / this.world.road.length,
          ),
          roadSegmentId: sample.segmentId,
          poles: [clonePole(vehicle.poles[0]), clonePole(vehicle.poles[1])],
        };
      }),
      stopEvents: this.stopEvents.map((event) => ({ ...event })),
      diagnostics: this.diagnostics.map((event) => ({ ...event })),
    };
  }

  private initializeVehicles(): void {
    this.vehicles = this.world.vehicles.map((configuration) => {
      const distance = wrap(configuration.initialDistance, this.world.road.length);
      let nextStopIndex = this.stops.findIndex((stop) => stop.distance >= distance + 0.5);
      if (nextStopIndex < 0) nextStopIndex = 0;
      const stop = this.stops[nextStopIndex]!;
      const nextStopDistance =
        stop.distance + (stop.distance < distance + 0.5 ? this.world.road.length : 0);
      const sample = this.world.road.sample(distance);
      const poles: [PoleContact, PoleContact] = [
        solvePoleContact(
          this.world.contact,
          calculatePoleBase(sample.position, sample.yaw, -1),
          configuration.poleLength,
          distance,
          'negative',
        ),
        solvePoleContact(
          this.world.contact,
          calculatePoleBase(sample.position, sample.yaw, 1),
          configuration.poleLength,
          distance,
          'positive',
        ),
      ];
      const releaseAt = Math.max(0, configuration.departureOffset);
      const plannedArrival =
        this.world.startTime +
        releaseAt +
        this.timetable.travelTime(distance, nextStopDistance, configuration);
      const vehicle: VehicleRuntime = {
        configuration,
        controller: this.createController(configuration),
        dynamics: createDynamicsState(),
        initialDistance: distance,
        totalDistance: distance,
        nextStopIndex,
        nextStopDistance,
        currentStopId: null,
        state: releaseAt > 0 ? 'waiting' : 'driving',
        doorOpen: 0,
        phaseElapsed: 0,
        dwellSeconds: 0,
        releaseAt,
        plannedArrival,
        plannedDeparture: this.timetable.departureTime(plannedArrival, stop),
        deviation: 0,
        passengers: this.random.integer(12, 34),
        poles,
      };
      this.reportContactFailure(vehicle);
      return vehicle;
    });
  }

  private findLeader(
    vehicle: VehicleRuntime,
  ): { gap: number; speed: number; length: number } | null {
    let nearest: { gap: number; speed: number; length: number } | null = null;
    for (const candidate of this.vehicles) {
      if (candidate === vehicle) continue;
      const gap = wrap(candidate.totalDistance - vehicle.totalDistance, this.world.road.length);
      if (!nearest || gap < nearest.gap)
        nearest = { gap, speed: candidate.dynamics.speed, length: candidate.configuration.length };
    }
    return nearest;
  }

  private arrive(vehicle: VehicleRuntime): void {
    const stop = this.stops[vehicle.nextStopIndex]!;
    vehicle.currentStopId = stop.id;
    vehicle.state = 'doors-opening';
    vehicle.phaseElapsed = 0;
    vehicle.dwellSeconds = clampDwell(stop.dwellSeconds + this.random.integer(0, 6));
    vehicle.passengers = Math.max(
      3,
      Math.min(65, vehicle.passengers + this.random.integer(-9, 13)),
    );
    this.recordStopEvent(vehicle, 'arrival', vehicle.plannedArrival);
  }

  private updateStopOperation(vehicle: VehicleRuntime, dt: number): void {
    vehicle.phaseElapsed += dt;
    if (vehicle.state === 'doors-opening') {
      vehicle.doorOpen = Math.min(1, vehicle.phaseElapsed / DOOR_TRANSITION_SECONDS);
      if (vehicle.doorOpen === 1) {
        vehicle.state = 'dwelling';
        vehicle.phaseElapsed = 0;
      }
    } else if (vehicle.state === 'dwelling' && vehicle.phaseElapsed >= vehicle.dwellSeconds) {
      vehicle.state = 'doors-closing';
      vehicle.phaseElapsed = 0;
    } else if (vehicle.state === 'doors-closing') {
      vehicle.doorOpen = Math.max(0, 1 - vehicle.phaseElapsed / DOOR_TRANSITION_SECONDS);
      if (vehicle.doorOpen === 0) this.depart(vehicle);
    }
  }

  private depart(vehicle: VehicleRuntime): void {
    this.recordStopEvent(vehicle, 'departure', vehicle.plannedDeparture);
    const previousStopDistance = vehicle.nextStopDistance;
    vehicle.nextStopIndex = (vehicle.nextStopIndex + 1) % this.stops.length;
    const stop = this.stops[vehicle.nextStopIndex]!;
    const previousWrapped = wrap(previousStopDistance, this.world.road.length);
    let legDistance = wrap(stop.distance - previousWrapped, this.world.road.length);
    if (legDistance < 0.001) legDistance = this.world.road.length;
    vehicle.nextStopDistance = previousStopDistance + legDistance;
    vehicle.plannedArrival =
      vehicle.plannedDeparture +
      this.timetable.travelTime(
        previousStopDistance,
        vehicle.nextStopDistance,
        vehicle.configuration,
      );
    vehicle.plannedDeparture = this.timetable.departureTime(vehicle.plannedArrival, stop);
    vehicle.currentStopId = null;
    vehicle.state = 'driving';
    vehicle.phaseElapsed = 0;
  }

  private recordStopEvent(
    vehicle: VehicleRuntime,
    kind: 'arrival' | 'departure',
    plannedTime: number,
  ): void {
    const actualTime = this.world.startTime + this.elapsed;
    vehicle.deviation = actualTime - plannedTime;
    this.stopEvents.push({
      vehicleId: vehicle.configuration.id,
      stopId: this.stops[vehicle.nextStopIndex]!.id,
      kind,
      plannedTime,
      actualTime,
      deviation: vehicle.deviation,
    });
    if (this.stopEvents.length > 512) this.stopEvents.shift();
  }

  private updateContacts(vehicle: VehicleRuntime): void {
    const sample = this.world.road.sample(vehicle.totalDistance);
    const { rollAngle, pitchAngle } = vehicle.dynamics;
    vehicle.poles = [
      solvePoleContact(
        this.world.contact,
        calculatePoleBase(sample.position, sample.yaw, -1, rollAngle, pitchAngle),
        vehicle.configuration.poleLength,
        vehicle.totalDistance,
        'negative',
        vehicle.poles[0].wireDistance,
      ),
      solvePoleContact(
        this.world.contact,
        calculatePoleBase(sample.position, sample.yaw, 1, rollAngle, pitchAngle),
        vehicle.configuration.poleLength,
        vehicle.totalDistance,
        'positive',
        vehicle.poles[1].wireDistance,
      ),
    ];
    this.reportContactFailure(vehicle);
  }

  private reportContactFailure(vehicle: VehicleRuntime): void {
    const failed = vehicle.poles.find((pole) => !pole.connected);
    if (!failed || vehicle.state === 'disconnected') return;
    vehicle.state = 'disconnected';
    this.diagnostics.push({
      time: this.world.startTime + this.elapsed,
      vehicleId: vehicle.configuration.id,
      message: failed.diagnostic ?? 'Trolley pole lost wire contact.',
    });
    if (this.diagnostics.length > 100) this.diagnostics.shift();
  }
}
