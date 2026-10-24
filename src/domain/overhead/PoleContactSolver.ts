import { unwrapNear } from '../../core/math/scalar';
import { distance3 } from '../../core/math/vector';
import type { ContactNetwork, PoleContact, Polarity, Vec3 } from '../types';

export interface PoleArticulationLimits {
  minimumElevation: number;
  maximumElevation: number;
  maximumHorizontalSlew: number;
}

export const DEFAULT_POLE_LIMITS: PoleArticulationLimits = {
  minimumElevation: (8 * Math.PI) / 180,
  maximumElevation: (65 * Math.PI) / 180,
  maximumHorizontalSlew: (70 * Math.PI) / 180,
};

/** Body-local roll about +z, then pitch about +x, followed by chassis yaw. */
export function calculatePoleBase(
  position: Vec3,
  yaw: number,
  side: number,
  roll = 0,
  pitch = 0,
): Vec3 {
  const x = side * 0.38;
  const y = 3.35;
  const z = -3.2;
  const rolledX = x * Math.cos(roll) - y * Math.sin(roll);
  const rolledY = x * Math.sin(roll) + y * Math.cos(roll);
  const pitchedY = rolledY * Math.cos(pitch) - z * Math.sin(pitch);
  const pitchedZ = rolledY * Math.sin(pitch) + z * Math.cos(pitch);
  return {
    x: position.x + rolledX * Math.cos(yaw) + pitchedZ * Math.sin(yaw),
    y: position.y + pitchedY,
    z: position.z - rolledX * Math.sin(yaw) + pitchedZ * Math.cos(yaw),
  };
}

/**
 * Intersects the fixed pole's reach sphere with its assigned wire circuit.
 * The rearward sphere root is followed on a continuous, unwrapped wire arc.
 * It does not project the head to the wire or change the physical pole length.
 */
export function solvePoleContact(
  network: ContactNetwork,
  base: Vec3,
  poleLength: number,
  roadDistance: number,
  polarity: Polarity,
  previousWireDistance?: number,
  limits: PoleArticulationLimits = DEFAULT_POLE_LIMITS,
): PoleContact {
  const wireLength = network.wireLength?.(polarity) ?? network.length;
  const mapped = network.routeToWireDistance?.(roadDistance, polarity) ?? roadDistance;
  const center =
    previousWireDistance === undefined
      ? mapped
      : unwrapNear(mapped, previousWireDistance + 10, wireLength);
  const forward = network.sample(center, polarity).tangent;
  let rejectedAngularConstraint = false;
  const connectedAt = (wireDistance: number): PoleContact | null => {
    const sample = network.sample(wireDistance, polarity);
    const backwardDot =
      (sample.position.x - base.x) * forward.x + (sample.position.z - base.z) * forward.z;
    const lengthError = Math.abs(distance3(base, sample.position) - poleLength);
    if (wireDistance >= center - 1 || backwardDot >= -0.5 || lengthError >= 0.00001) return null;
    const horizontalReach = Math.hypot(sample.position.x - base.x, sample.position.z - base.z);
    const elevation = Math.atan2(sample.position.y - base.y, horizontalReach);
    const slew = Math.acos(Math.min(1, Math.max(-1, -backwardDot / horizontalReach)));
    if (
      elevation < limits.minimumElevation ||
      elevation > limits.maximumElevation ||
      slew > limits.maximumHorizontalSlew
    ) {
      rejectedAngularConstraint = true;
      return null;
    }
    return {
      base,
      head: sample.position,
      wireDistance,
      wireSegmentId: sample.segmentId,
      connected: true,
      lengthError,
      wireError: 0,
      diagnostic: null,
    };
  };

  // Temporal coherence normally converges in two iterations. The global-local
  // bracket below remains the recovery path for initialization and large moves.
  let estimate = previousWireDistance ?? center - 10;
  for (let iteration = 0; iteration < 7; iteration += 1) {
    const sample = network.sample(estimate, polarity);
    const relative = {
      x: sample.position.x - base.x,
      y: sample.position.y - base.y,
      z: sample.position.z - base.z,
    };
    const error = relative.x ** 2 + relative.y ** 2 + relative.z ** 2 - poleLength ** 2;
    if (Math.abs(error) < 0.00001) {
      const contact = connectedAt(estimate);
      if (contact) return contact;
      break;
    }
    const derivative =
      2 *
      (relative.x * sample.tangent.x +
        relative.y * sample.tangent.y +
        relative.z * sample.tangent.z);
    if (derivative > -0.2) break;
    estimate -= error / derivative;
    if (estimate < center - 30 || estimate > center - 1) break;
  }
  const squaredError = (distance: number): number => {
    const head = network.sample(distance, polarity).position;
    return (
      (head.x - base.x) ** 2 + (head.y - base.y) ** 2 + (head.z - base.z) ** 2 - poleLength ** 2
    );
  };
  const candidates: number[] = [];
  // Local search also prevents switching to the nearby opposing-direction wire.
  const start = center - Math.max(30, poleLength * 3.5);
  let beforeDistance = start;
  let beforeError = squaredError(beforeDistance);
  const end = center + 0.5;
  const step = 0.65;
  for (let distance = start + step; distance <= end + step; distance += step) {
    const afterDistance = Math.min(distance, end);
    const afterError = squaredError(afterDistance);
    if (beforeError >= 0 && afterError <= 0) {
      let low = beforeDistance;
      let high = afterDistance;
      for (let iteration = 0; iteration < 28; iteration += 1) {
        const middle = (low + high) / 2;
        if (squaredError(middle) > 0) low = middle;
        else high = middle;
      }
      const root = (low + high) / 2;
      const sample = network.sample(root, polarity);
      const backwardDot =
        (sample.position.x - base.x) * forward.x + (sample.position.z - base.z) * forward.z;
      if (root < center - 1 && backwardDot < -0.5) candidates.push(root);
    }
    beforeDistance = afterDistance;
    beforeError = afterError;
    if (afterDistance === end) break;
  }
  if (candidates.length > 0) {
    const expected = previousWireDistance ?? center - 10;
    const wireDistance = candidates.reduce((best, candidate) =>
      Math.abs(candidate - expected) < Math.abs(best - expected) ? candidate : best,
    );
    const contact = connectedAt(wireDistance);
    if (contact) return contact;
  }

  // A disconnected pole remains at its physical length, visibly below the wire.
  // There is no fake wire point or hidden pole stretching on invalid geometry.
  const angle = Math.PI / 7;
  const head = {
    x: base.x - forward.x * poleLength * Math.cos(angle),
    y: base.y + poleLength * Math.sin(angle),
    z: base.z - forward.z * poleLength * Math.cos(angle),
  };
  const wireDistance = previousWireDistance ?? center - poleLength;
  const sample = network.sample(wireDistance, polarity);
  return {
    base,
    head,
    wireDistance,
    wireSegmentId: sample.segmentId,
    connected: false,
    lengthError: Math.abs(distance3(base, head) - poleLength),
    wireError: distance3(head, sample.position),
    diagnostic: rejectedAngularConstraint
      ? `Pole articulation limits exceeded for ${polarity} wire at route distance ${roadDistance.toFixed(2)} m.`
      : `No reachable trailing ${polarity} wire contact at route distance ${roadDistance.toFixed(2)} m.`,
  };
}
