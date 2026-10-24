import { CubicBezier, type CubicDefinition } from '../../core/geometry/CubicBezier';
import { wrap } from '../../core/math/scalar';
import { normalize3 } from '../../core/math/vector';
import type { PathSample, RoadPath, RoadSegment } from '../types';

export class RoadNetwork implements RoadPath {
  readonly segments: RoadSegment[];
  readonly length: number;
  private readonly curves: CubicBezier[];

  constructor(definitions: CubicDefinition[]) {
    if (definitions.length === 0) throw new Error('A road needs at least one geometric segment.');
    this.curves = definitions.map((definition) => new CubicBezier(definition));
    let distance = 0;
    this.segments = this.curves.map((curve, index) => {
      const segment = {
        id: curve.definition.id,
        startDistance: distance,
        length: curve.length,
        speedLimit: curve.definition.speedLimit,
        nextSegmentIds: [definitions[(index + 1) % definitions.length]!.id],
      };
      distance += curve.length;
      return segment;
    });
    this.length = distance;
  }

  sample(distance: number): PathSample {
    const wrapped = wrap(distance, this.length);
    let index = this.segments.findIndex(
      (segment) => wrapped < segment.startDistance + segment.length,
    );
    if (index < 0) index = this.segments.length - 1;
    const segment = this.segments[index]!;
    const curve = this.curves[index]!;
    const t = curve.parameterAtDistance(wrapped - segment.startDistance);
    const derivative = curve.derivative(t);
    const second = curve.secondDerivative(t);
    const tangent = normalize3(derivative);
    const planarSpeed = Math.hypot(derivative.x, derivative.z);
    return {
      position: curve.position(t),
      tangent,
      yaw: Math.atan2(tangent.x, tangent.z),
      curvature:
        (derivative.z * second.x - derivative.x * second.z) / Math.max(planarSpeed ** 3, 1e-12),
      segmentId: segment.id,
    };
  }
}
