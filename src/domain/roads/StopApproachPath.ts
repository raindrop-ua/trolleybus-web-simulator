import type { PathSample, RoadPath, StopDefinition } from '../types';

export const STOP_CURB_OFFSET = -2.2;
const wrap = (d: number, length: number) => ((d % length) + length) % length;
// Zero first and second derivatives at each end, including the stationary berth.
const ease = (t: number) => t * t * t * (10 + t * (-15 + 6 * t));

/** Vehicle-only curb approach. Reference road distances and overhead paths stay unchanged. */
export class StopApproachPath implements RoadPath {
  readonly length: number;
  readonly segments;
  private readonly berths: { distance: number; entry: number; exit: number }[];

  constructor(
    private readonly road: RoadPath,
    stops: StopDefinition[],
  ) {
    this.length = road.length;
    this.segments = road.segments;
    const sorted = [...stops].sort((a, b) => a.distance - b.distance);
    this.berths = sorted.map((stop, index) => {
      const previous = sorted[(index + sorted.length - 1) % sorted.length]!;
      const next = sorted[(index + 1) % sorted.length]!;
      const before = wrap(stop.distance - previous.distance, this.length) || this.length;
      const after = wrap(next.distance - stop.distance, this.length) || this.length;
      // Adjacent approaches cannot overlap, even on the compressed city circuit.
      return {
        distance: stop.distance,
        entry: Math.min(34, before * 0.55),
        exit: Math.min(30, after * 0.4),
      };
    });
  }

  lateralOffset(distance: number): number {
    for (const berth of this.berths) {
      const relative =
        wrap(distance - berth.distance + this.length / 2, this.length) - this.length / 2;
      if (relative < -berth.entry || relative > berth.exit) continue;
      const holdBefore = Math.min(3, berth.entry * 0.2);
      const holdAfter = Math.min(5, berth.exit * 0.25);
      const blend =
        relative < -holdBefore
          ? ease((relative + berth.entry) / (berth.entry - holdBefore))
          : relative > holdAfter
            ? 1 - ease((relative - holdAfter) / (berth.exit - holdAfter))
            : 1;
      return STOP_CURB_OFFSET * blend;
    }
    return 0;
  }

  private position(distance: number) {
    const base = this.road.sample(distance);
    const offset = this.lateralOffset(distance);
    return {
      x: base.position.x + Math.cos(base.yaw) * offset,
      y: base.position.y,
      z: base.position.z - Math.sin(base.yaw) * offset,
    };
  }

  sample(distance: number): PathSample & { distanceScale: number; lateralOffset: number } {
    const base = this.road.sample(distance);
    const lateralOffset = this.lateralOffset(distance);
    const h = 0.12;
    if (
      lateralOffset === 0 &&
      this.lateralOffset(distance - h) === 0 &&
      this.lateralOffset(distance + h) === 0
    )
      return { ...base, lateralOffset, distanceScale: 1 };
    const position = this.position(distance),
      before = this.position(distance - h),
      after = this.position(distance + h);
    const dx = (after.x - before.x) / (2 * h),
      dz = (after.z - before.z) / (2 * h);
    const ddx = (after.x - 2 * position.x + before.x) / (h * h);
    const ddz = (after.z - 2 * position.z + before.z) / (h * h);
    const distanceScale = Math.hypot(dx, dz);
    return {
      ...base,
      position,
      tangent: { x: dx / distanceScale, y: 0, z: dz / distanceScale },
      yaw: Math.atan2(dx, dz),
      curvature: (dz * ddx - dx * ddz) / Math.max(distanceScale ** 3, 1e-12),
      distanceScale,
      lateralOffset,
    };
  }
}
