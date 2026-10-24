import type { RoadPath } from '../types';

/** Brake before the bend or lower limit enters the vehicle's current segment. */
export function observeRoad(
  road: RoadPath,
  distance: number,
  speed: number,
  maximumSpeed: number,
): { curvature: number; upcomingCurvature: number; speedLimit: number } {
  const current = road.sample(distance);
  let upcomingCurvature = Math.abs(current.curvature);
  let speedLimit = maximumSpeed;
  const horizon = 8 + speed * 3.5;
  for (const fraction of [0, 0.3, 0.65, 1]) {
    const sample = fraction === 0 ? current : road.sample(distance + horizon * fraction);
    upcomingCurvature = Math.max(upcomingCurvature, Math.abs(sample.curvature));
    const segment = road.segments.find((item) => item.id === sample.segmentId);
    speedLimit = Math.min(speedLimit, segment?.speedLimit ?? maximumSpeed);
  }
  return { curvature: current.curvature, upcomingCurvature, speedLimit };
}
