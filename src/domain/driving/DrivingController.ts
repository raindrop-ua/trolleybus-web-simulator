import type { DrivingCommand, VehicleConfiguration } from '../types';

export interface DrivingContext {
  configuration: VehicleConfiguration;
  speed: number;
  speedLimit: number;
  curvature: number;
  upcomingCurvature?: number;
  distanceToStop: number;
  mayDepart: boolean;
  leader: { gap: number; speed: number; length: number } | null;
}

/** A future human driver can implement this boundary without changing vehicle dynamics. */
export interface DrivingController {
  update(context: DrivingContext, deltaTime: number): DrivingCommand;
}
