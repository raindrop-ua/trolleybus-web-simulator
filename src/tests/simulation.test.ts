import { describe, expect, it } from 'vitest';
import { createWorldDefinition } from '../data/world';
import type { VehicleConfiguration } from '../domain/types';
import { AutonomousDriver } from '../domain/driving/AutonomousDriver';
import { createDynamicsState, integrateVehicleDynamics } from '../domain/vehicles/VehicleDynamics';
import { SimulationClock } from '../simulation/SimulationClock';
import { SimulationEngine } from '../simulation/SimulationEngine';

const configuration: VehicleConfiguration = {
  id: 'test',
  initialDistance: 0,
  departureOffset: 0,
  length: 12,
  width: 2.55,
  wheelbase: 6,
  poleLength: 6.2,
  maxSpeed: 12,
  acceleration: 1.15,
  braking: 2.4,
};
const dt = 1 / 60;

describe('independent vehicle dynamics and driving command boundary', () => {
  it('accelerates with finite jerk, caps speed and brakes continuously to rest', () => {
    const state = createDynamicsState();
    let previousSpeed = 0;
    let distance = 0;
    for (let tick = 0; tick < 1200; tick += 1) {
      distance += integrateVehicleDynamics(
        state,
        { traction: 1, braking: 0, steering: 0, doorsRequestedOpen: false },
        configuration,
        0,
        dt,
      );
      expect(state.speed - previousSpeed).toBeLessThanOrEqual(
        configuration.acceleration * dt + 1e-9,
      );
      expect(state.speed).toBeLessThanOrEqual(configuration.maxSpeed);
      previousSpeed = state.speed;
    }
    expect(distance).toBeGreaterThan(150);
    expect(state.speed).toBe(configuration.maxSpeed);
    for (let tick = 0; tick < 600; tick += 1) {
      integrateVehicleDynamics(
        state,
        { traction: 0, braking: 1, steering: 0, doorsRequestedOpen: false },
        configuration,
        0,
        dt,
      );
      expect(previousSpeed - state.speed).toBeLessThanOrEqual(configuration.braking * dt + 1e-9);
      previousSpeed = state.speed;
    }
    expect(state.speed).toBe(0);
  });

  it('steers into a turn, leans outward and settles through damped suspension', () => {
    const state = createDynamicsState();
    state.speed = 8;
    for (let tick = 0; tick < 180; tick += 1)
      integrateVehicleDynamics(
        state,
        { traction: 0, braking: 0, steering: 0.65, doorsRequestedOpen: false },
        configuration,
        0.04,
        dt,
      );
    expect(state.steeringAngle).toBeCloseTo(0.65 * 0.55, 6);
    expect(state.rollAngle).toBeGreaterThan(0.05);
    expect(state.rollAngle).toBeLessThanOrEqual(0.085);
    for (let tick = 0; tick < 240; tick += 1)
      integrateVehicleDynamics(
        state,
        { traction: 0, braking: 0, steering: 0, doorsRequestedOpen: false },
        configuration,
        0,
        dt,
      );
    expect(Math.abs(state.rollAngle)).toBeLessThan(0.0001);
  });

  it('uses normalized commands and brakes before a stop, bend or stationary leader', () => {
    const driver = new AutonomousDriver();
    const context = {
      configuration,
      speed: 10,
      speedLimit: 12,
      curvature: 0,
      distanceToStop: 200,
      mayDepart: true,
      leader: null,
    };
    const straight = driver.update(context, dt);
    const stop = driver.update({ ...context, distanceToStop: 10 }, dt);
    const bend = driver.update({ ...context, upcomingCurvature: 0.12 }, dt);
    const leader = driver.update({ ...context, leader: { gap: 25, speed: 0, length: 12 } }, dt);
    expect(straight.traction).toBeGreaterThan(0);
    for (const command of [straight, stop, bend, leader]) {
      expect(command.traction).toBeGreaterThanOrEqual(0);
      expect(command.traction).toBeLessThanOrEqual(1);
      expect(command.braking).toBeGreaterThanOrEqual(0);
      expect(command.braking).toBeLessThanOrEqual(1);
      expect(Math.abs(command.steering)).toBeLessThanOrEqual(1);
    }
    expect(stop.braking).toBeGreaterThan(0);
    expect(bend.braking).toBeGreaterThan(0);
    expect(leader.braking).toBeGreaterThan(0);
  });
});

describe('fixed simulation clock', () => {
  it.each([120, 144])(
    'preserves fractional ticks when frame-synchronized controls repeat at %i Hz',
    (refreshRate) => {
      const clock = new SimulationClock();
      let ticks = 0;
      for (let frame = 0; frame < refreshRate * 10; frame += 1) {
        // Bootstrap synchronizes the same UI controls before every rendered frame.
        clock.setPaused(false);
        clock.setSpeed(1);
        clock.advance(1 / refreshRate, () => {
          ticks += 1;
        });
      }
      expect(ticks).toBe(600);
    },
  );

  it('retains fractional elapsed time when changing the simulation speed', () => {
    const clock = new SimulationClock();
    let ticks = 0;
    expect(
      clock.advance(1 / 120, () => {
        ticks += 1;
      }),
    ).toBe(0);
    clock.setSpeed(2);
    expect(
      clock.advance(1 / 240, () => {
        ticks += 1;
      }),
    ).toBe(1);
    expect(ticks).toBe(1);
  });

  it('is frame-independent, pauses, scales speed and bounds suspended-tab catch-up', () => {
    const sixty = new SimulationClock();
    const thirty = new SimulationClock();
    let first = 0;
    let second = 0;
    for (let frame = 0; frame < 60; frame += 1)
      sixty.advance(1 / 60, () => {
        first += 1;
      });
    for (let frame = 0; frame < 30; frame += 1)
      thirty.advance(1 / 30, () => {
        second += 1;
      });
    expect(first).toBe(60);
    expect(second).toBe(first);
    sixty.setPaused(true);
    sixty.advance(10, () => {
      first += 1;
    });
    expect(first).toBe(60);
    sixty.setPaused(false);
    sixty.setSpeed(4);
    expect(
      sixty.advance(1 / 60, () => {
        first += 1;
      }),
    ).toBe(4);
    expect(
      sixty.advance(60, () => {
        first += 1;
      }),
    ).toBe(60);
  });
});

describe('fleet simulation and timetables', () => {
  it('can replace the autonomous controller without changing vehicle dynamics', () => {
    const world = createWorldDefinition();
    const engine = new SimulationEngine(world, 6, () => ({
      update: () => ({ traction: 0, braking: 1, steering: 0, doorsRequestedOpen: false }),
    }));
    const initial = engine.snapshot();
    for (let tick = 0; tick < 180; tick += 1) engine.step();
    expect(engine.snapshot().vehicles.map((vehicle) => vehicle.totalDistance)).toEqual(
      initial.vehicles.map((vehicle) => vehicle.totalDistance),
    );
  });

  it('produces stable deterministic snapshots, matching render rates and pause/speed controls', () => {
    const world = createWorldDefinition();
    const first = new SimulationEngine(world, 42);
    const second = new SimulationEngine(world, 42);
    for (let frame = 0; frame < 120; frame += 1) first.advance(1 / 60);
    for (let frame = 0; frame < 60; frame += 1) second.advance(1 / 30);
    expect(first.snapshot()).toEqual(second.snapshot());
    const stable = first.snapshot();
    stable.vehicles[0]!.position.x += 999;
    stable.vehicles[0]!.poles[0].head.y += 999;
    expect(first.snapshot()).toEqual(second.snapshot());
    const paused = first.snapshot();
    first.setPaused(true);
    first.advance(0.2);
    first.step();
    expect(first.snapshot()).toEqual(paused);
    first.setPaused(false);
    first.setSpeed(4);
    first.advance(1 / 60);
    for (let tick = 0; tick < 4; tick += 1) second.step();
    expect(first.snapshot()).toEqual(second.snapshot());
    first.reset(42);
    expect(first.snapshot()).toEqual(new SimulationEngine(world, 42).snapshot());
  });

  it('reports invalid contact explicitly and keeps disconnected vehicles stopped', () => {
    const world = createWorldDefinition();
    const contact = world.contact;
    world.contact = {
      ...contact,
      sample: (distance, polarity) => {
        const sample = contact.sample(distance, polarity);
        return { ...sample, position: { ...sample.position, y: sample.position.y + 100 } };
      },
    };
    const engine = new SimulationEngine(world);
    for (let tick = 0; tick < 60; tick += 1) engine.step();
    const snapshot = engine.snapshot();
    expect(snapshot.diagnostics).toHaveLength(3);
    expect(
      snapshot.vehicles.every(
        (vehicle) => vehicle.operationalState === 'disconnected' && vehicle.speed === 0,
      ),
    ).toBe(true);
    expect(
      snapshot.vehicles.every((vehicle) =>
        vehicle.poles.every((pole) => !pole.connected && pole.lengthError < 0.01),
      ),
    ).toBe(true);
  });

  it('brakes a moving vehicle continuously after contact is lost and reports one fault per vehicle', () => {
    const world = createWorldDefinition();
    const engine = new SimulationEngine(world);
    for (let tick = 0; tick < 60 * 25; tick += 1) engine.step();
    const moving = engine.snapshot().vehicles.find((vehicle) => vehicle.speed > 1);
    expect(moving).toBeDefined();
    const contactSample = world.contact.sample.bind(world.contact);
    world.contact.sample = (distance, polarity) => {
      const sample = contactSample(distance, polarity);
      return { ...sample, position: { ...sample.position, y: sample.position.y + 100 } };
    };
    let previousSpeed = moving!.speed;
    for (let tick = 0; tick < 60 * 20; tick += 1) {
      engine.step();
      const vehicle = engine.snapshot().vehicles.find((candidate) => candidate.id === moving!.id)!;
      expect(previousSpeed - vehicle.speed).toBeLessThanOrEqual(
        world.vehicles[0]!.braking * dt + 1e-9,
      );
      previousSpeed = vehicle.speed;
    }
    const snapshot = engine.snapshot();
    expect(snapshot.diagnostics).toHaveLength(3);
    expect(
      snapshot.vehicles.every(
        (vehicle) => vehicle.speed === 0 && vehicle.operationalState === 'disconnected',
      ),
    ).toBe(true);
  });

  it('completes repeated round trips through all ten stop visits with safe bunching, doors and real delays', () => {
    const world = createWorldDefinition();
    // Starting only 22 m apart exercises the following controller throughout station dwell.
    world.vehicles = world.vehicles.map((vehicle, index) => ({
      ...vehicle,
      initialDistance: 22 * index,
      departureOffset: 0,
    }));
    const engine = new SimulationEngine(world, 123);
    let completed = false;
    for (let tick = 0; tick < 60 * 1500; tick += 1) {
      engine.step();
      if (tick % 30 !== 0) continue;
      const snapshot = engine.snapshot();
      expect(snapshot.diagnostics).toHaveLength(0);
      const sorted = [...snapshot.vehicles].sort(
        (left, right) => left.distanceAlongRoute - right.distanceAlongRoute,
      );
      sorted.forEach((vehicle, index) => {
        const next = sorted[(index + 1) % sorted.length]!;
        const gap =
          (next.distanceAlongRoute - vehicle.distanceAlongRoute + world.road.length) %
          world.road.length;
        expect(gap).toBeGreaterThan(12);
        if (vehicle.doorOpen > 0) expect(vehicle.speed).toBe(0);
        expect(
          vehicle.poles.every(
            (pole) => pole.connected && pole.lengthError < 0.01 && pole.wireError < 0.01,
          ),
        ).toBe(true);
        if (vehicle.currentStopId) {
          const stop = world.stops.find((item) => item.id === vehicle.currentStopId)!;
          const stopError = Math.abs(
            ((stop.distance -
              vehicle.distanceAlongRoute +
              world.road.length / 2 +
              world.road.length) %
              world.road.length) -
              world.road.length / 2,
          );
          expect(stopError).toBeLessThan(0.36);
        }
      });
      if (snapshot.vehicles.every((vehicle) => vehicle.completedLaps >= 2)) {
        completed = true;
        break;
      }
    }
    expect(completed).toBe(true);
    const snapshot = engine.snapshot();
    for (const vehicle of snapshot.vehicles) {
      const events = snapshot.stopEvents.filter((event) => event.vehicleId === vehicle.id);
      const arrivals = events.filter((event) => event.kind === 'arrival');
      expect(new Set(arrivals.map((event) => event.stopId)).size).toBe(10);
      expect(arrivals.length).toBeGreaterThanOrEqual(20);
      for (const event of events)
        expect(event.deviation).toBeCloseTo(event.actualTime - event.plannedTime, 8);
      const firstArrival = arrivals[0]!;
      const firstDeparture = events.find((event) => event.kind === 'departure')!;
      expect(firstDeparture.actualTime - firstArrival.actualTime).toBeGreaterThanOrEqual(10.19);
      expect(firstDeparture.actualTime - firstArrival.actualTime).toBeLessThan(22.4);
      // A long passenger exchange changes the actual deviation without rewriting its planned time.
      expect(firstDeparture.deviation - firstArrival.deviation).toBeGreaterThanOrEqual(-0.01);
      const secondArrival = arrivals[1]!;
      expect(secondArrival.plannedTime).toBeGreaterThan(firstDeparture.plannedTime);
    }
    expect(snapshot.stopEvents.some((event) => Math.abs(event.deviation) > 1)).toBe(true);
  }, 120_000);
});
