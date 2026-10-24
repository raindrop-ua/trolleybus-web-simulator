import type { DrivingCommand } from '../types';
import type { DrivingContext, DrivingController } from './DrivingController';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const MAX_STEERING_ANGLE = 0.55;
export const MINIMUM_BUMPER_GAP = 4;

/** Conservative stopping envelope includes reaction/jerk time, not just v² / 2a. */
function safeSpeed(distance: number, braking: number, response: number): number {
  return (
    braking * (Math.sqrt(response * response + (2 * Math.max(0, distance)) / braking) - response)
  );
}

export class AutonomousDriver implements DrivingController {
  update(context: DrivingContext, _deltaTime: number): DrivingCommand {
    const { configuration, speed, curvature, distanceToStop, leader } = context;
    const comfortableBraking = configuration.braking * 0.62;
    const curveLimit = Math.sqrt(
      1.25 / Math.max(Math.abs(context.upcomingCurvature ?? curvature), 0.00001),
    );
    let targetSpeed = Math.min(configuration.maxSpeed, context.speedLimit, curveLimit);
    targetSpeed = Math.min(targetSpeed, safeSpeed(distanceToStop, comfortableBraking, 0.7));

    if (leader) {
      const minimumCenterGap = (configuration.length + leader.length) / 2 + MINIMUM_BUMPER_GAP;
      const brakingAllowance = (leader.speed * leader.speed) / (2 * comfortableBraking);
      targetSpeed = Math.min(
        targetSpeed,
        safeSpeed(leader.gap - minimumCenterGap + brakingAllowance, comfortableBraking, 1.5),
      );
    }

    const steering = clamp(
      Math.atan(configuration.wheelbase * curvature) / MAX_STEERING_ANGLE,
      -1,
      1,
    );
    if (!context.mayDepart || (distanceToStop < 0.3 && speed < 0.3)) {
      return {
        traction: 0,
        braking: 1,
        steering,
        doorsRequestedOpen: distanceToStop < 0.35 && speed < 0.05,
      };
    }

    const requestedAcceleration = clamp(
      (targetSpeed - speed) * 1.8,
      -configuration.braking,
      configuration.acceleration,
    );
    return {
      traction: clamp(requestedAcceleration / configuration.acceleration, 0, 1),
      braking: clamp(-requestedAcceleration / configuration.braking, 0, 1),
      steering,
      doorsRequestedOpen: false,
    };
  }
}
