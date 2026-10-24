import type { Vector3 as Vec3 } from '../math/types';
import { clamp } from '../math/scalar';
import { distance3 } from '../math/vector';

export interface CubicDefinition {
  id: string;
  points: [Vec3, Vec3, Vec3, Vec3];
  speedLimit: number;
}

/** Cubic geometry with a monotonic arc-length lookup, independent of any renderer. */
export class CubicBezier {
  readonly length: number;
  private readonly distances: number[] = [0];
  private readonly divisions = 256;

  constructor(readonly definition: CubicDefinition) {
    let previous = this.position(0);
    for (let index = 1; index <= this.divisions; index += 1) {
      const point = this.position(index / this.divisions);
      this.distances.push(this.distances[index - 1]! + distance3(point, previous));
      previous = point;
    }
    this.length = this.distances[this.divisions]!;
  }

  position(t: number): Vec3 {
    const [a, b, c, d] = this.definition.points;
    const u = 1 - t;
    return {
      x: u ** 3 * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t ** 3 * d.x,
      y: u ** 3 * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t ** 3 * d.y,
      z: u ** 3 * a.z + 3 * u * u * t * b.z + 3 * u * t * t * c.z + t ** 3 * d.z,
    };
  }

  derivative(t: number): Vec3 {
    const [a, b, c, d] = this.definition.points;
    const u = 1 - t;
    return {
      x: 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
      y: 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y),
      z: 3 * u * u * (b.z - a.z) + 6 * u * t * (c.z - b.z) + 3 * t * t * (d.z - c.z),
    };
  }

  secondDerivative(t: number): Vec3 {
    const [a, b, c, d] = this.definition.points;
    return {
      x: 6 * (1 - t) * (c.x - 2 * b.x + a.x) + 6 * t * (d.x - 2 * c.x + b.x),
      y: 6 * (1 - t) * (c.y - 2 * b.y + a.y) + 6 * t * (d.y - 2 * c.y + b.y),
      z: 6 * (1 - t) * (c.z - 2 * b.z + a.z) + 6 * t * (d.z - 2 * c.z + b.z),
    };
  }

  parameterAtDistance(distance: number): number {
    const target = clamp(distance, 0, this.length);
    let low = 0;
    let high = this.divisions;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (this.distances[middle]! < target) low = middle;
      else high = middle;
    }
    const span = this.distances[high]! - this.distances[low]!;
    return (low + (span > 0 ? (target - this.distances[low]!) / span : 0)) / this.divisions;
  }
}
