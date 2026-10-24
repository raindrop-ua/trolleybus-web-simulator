import type { DrivingCommand, VehicleConfiguration } from '../types';
import { MAX_STEERING_ANGLE } from '../driving/AutonomousDriver';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export interface DynamicsState {
  speed: number;
  acceleration: number;
  steeringAngle: number;
  rollAngle: number;
  rollVelocity: number;
  pitchAngle: number;
  pitchVelocity: number;
}

export function createDynamicsState(): DynamicsState {
  return {
    speed: 0,
    acceleration: 0,
    steeringAngle: 0,
    rollAngle: 0,
    rollVelocity: 0,
    pitchAngle: 0,
    pitchVelocity: 0,
  };
}

/** Longitudinal integration plus bicycle steering and independent body suspension. */
export function integrateVehicleDynamics(
  state: DynamicsState,
  command: DrivingCommand,
  configuration: VehicleConfiguration,
  curvature: number,
  dt: number,
): number {
  const desiredAcceleration =
    clamp(command.traction, 0, 1) * configuration.acceleration -
    clamp(command.braking, 0, 1) * configuration.braking;
  const previousSpeed = state.speed;
  const jerk = 3.2;
  state.acceleration += clamp(desiredAcceleration - state.acceleration, -jerk * dt, jerk * dt);
  state.speed = clamp(previousSpeed + state.acceleration * dt, 0, configuration.maxSpeed);
  // A stationary vehicle has no longitudinal acceleration, even while the brakes are held.
  if (state.speed === 0 && state.acceleration < 0) state.acceleration = 0;
  const targetSteering = clamp(command.steering, -1, 1) * MAX_STEERING_ANGLE;
  state.steeringAngle += clamp(targetSteering - state.steeringAngle, -0.9 * dt, 0.9 * dt);

  const lateralAcceleration = state.speed * state.speed * curvature;
  // Positive curvature turns toward local +x; positive roll moves the roof toward -x.
  // Limit the outward lean to 2.5° and damp it gently back to level after the turn.
  const maximumRoll = (2.5 * Math.PI) / 180;
  const rollTarget = clamp(lateralAcceleration * 0.028, -maximumRoll, maximumRoll);
  const pitchTarget = clamp(-state.acceleration * 0.012, -0.035, 0.035);
  state.rollVelocity += (40 * (rollTarget - state.rollAngle) - 12.8 * state.rollVelocity) * dt;
  state.pitchVelocity += (65 * (pitchTarget - state.pitchAngle) - 15 * state.pitchVelocity) * dt;
  state.rollAngle += state.rollVelocity * dt;
  state.pitchAngle += state.pitchVelocity * dt;

  // Trapezoidal integration makes velocity continuous and avoids frame-rate drift.
  return (previousSpeed + state.speed) * 0.5 * dt;
}
