import { CubicBezier, type CubicDefinition } from '../../core/geometry/CubicBezier';
import { clamp, wrap } from '../../core/math/scalar';
import { distance3, normalize3 } from '../../core/math/vector';
import { selectRouteBranch } from './ContactSwitch';
import type {
  ContactNetwork,
  ContactSwitch,
  PathSample,
  Polarity,
  RoadPath,
  Vec3,
  WireSegment,
} from '../types';

const POLARITIES: Polarity[] = ['negative', 'positive'];
const LOOKUP_STEP = 0.1;

export interface ContactJunctionDefinition {
  id: string;
  startRoadDistance: number;
  endRoadDistance: number;
  branchOffset: number;
  controlLead: number;
  routeActuation: 'traction' | 'coasting';
}

export interface ContactNetworkConfiguration {
  wireHeight: number;
  halfSeparation: number;
  junctions: ContactJunctionDefinition[];
}

/** Actual wire metres map to the road's arc length through an independent lookup. */
class ParallelWirePath {
  readonly length: number;
  readonly distances = [0];
  readonly roadDistances = [0];

  constructor(
    private readonly road: RoadPath,
    private readonly polarity: Polarity,
    private readonly configuration: ContactNetworkConfiguration,
  ) {
    const count = Math.ceil(road.length / LOOKUP_STEP);
    const samples = [
      ...new Set([
        ...Array.from({ length: count }, (_, index) => ((index + 1) / count) * road.length),
        ...road.segments.slice(1).map((segment) => segment.startDistance),
      ]),
    ].sort((a, b) => a - b);
    let previous = this.positionAtRoadDistance(0);
    for (let index = 1; index <= samples.length; index += 1) {
      const routeDistance = samples[index - 1]!;
      const position = this.positionAtRoadDistance(routeDistance);
      this.roadDistances.push(routeDistance);
      this.distances.push(this.distances[index - 1]! + distance3(previous, position));
      previous = position;
    }
    this.length = this.distances[samples.length]!;
  }

  positionAtRoadDistance(distance: number): Vec3 {
    const sample = this.road.sample(distance);
    const side = this.polarity === 'positive' ? 1 : -1;
    return {
      x: sample.position.x + Math.cos(sample.yaw) * this.configuration.halfSeparation * side,
      y: this.configuration.wireHeight,
      z: sample.position.z - Math.sin(sample.yaw) * this.configuration.halfSeparation * side,
    };
  }

  private interpolate(source: number[], target: number[], value: number): number {
    let low = 0;
    let high = source.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (source[middle]! < value) low = middle;
      else high = middle;
    }
    const amount = (value - source[low]!) / (source[high]! - source[low]!);
    return target[low]! + amount * (target[high]! - target[low]!);
  }

  fromRoadDistance(distance: number): number {
    const lap = Math.floor(distance / this.road.length);
    return (
      lap * this.length +
      this.interpolate(this.roadDistances, this.distances, wrap(distance, this.road.length))
    );
  }

  toRoadDistance(distance: number): number {
    return this.interpolate(this.distances, this.roadDistances, wrap(distance, this.length));
  }

  sample(distance: number, segmentId: string): PathSample {
    const routeDistance = this.toRoadDistance(distance);
    const position = this.positionAtRoadDistance(routeDistance);
    const roadSample = this.road.sample(routeDistance);
    // A regular planar parallel curve has the same unit tangent as its source.
    const tangent = roadSample.tangent;
    const offset = this.configuration.halfSeparation * (this.polarity === 'positive' ? 1 : -1);
    return {
      position,
      tangent,
      yaw: Math.atan2(tangent.x, tangent.z),
      curvature: roadSample.curvature / (1 - roadSample.curvature * offset),
      segmentId,
    };
  }
}

interface BranchCurve {
  curve: CubicBezier;
  segment: WireSegment;
}

/** Paired directional circuits plus a geometric depot turnout for each polarity. */
export class OverheadContactNetwork implements ContactNetwork {
  readonly length: number;
  readonly segments: WireSegment[] = [];
  readonly switches: ContactSwitch[] = [];
  private readonly paths: Record<Polarity, ParallelWirePath>;
  private readonly branches = new Map<string, BranchCurve>();
  private readonly mainSegments: Record<Polarity, WireSegment[]> = { negative: [], positive: [] };

  constructor(road: RoadPath, configuration: ContactNetworkConfiguration) {
    this.paths = {
      negative: new ParallelWirePath(road, 'negative', configuration),
      positive: new ParallelWirePath(road, 'positive', configuration),
    };
    this.length = Math.max(this.paths.negative.length, this.paths.positive.length);
    const boundaries = [
      ...new Set([
        0,
        ...road.segments.map((segment) => segment.startDistance),
        ...configuration.junctions.flatMap((junction) => [
          junction.startRoadDistance,
          junction.endRoadDistance,
        ]),
      ]),
    ].sort((a, b) => a - b);
    for (const polarity of POLARITIES) {
      const path = this.paths[polarity];
      const list = boundaries.map((boundary, index): WireSegment => {
        const next = boundaries[index + 1] ?? road.length;
        return {
          id: `${polarity}-wire-${index}`,
          startDistance: path.fromRoadDistance(boundary),
          length: path.fromRoadDistance(next) - path.fromRoadDistance(boundary),
          startNodeId: `${polarity}-node-${index}`,
          endNodeId: `${polarity}-node-${(index + 1) % boundaries.length}`,
          polarity,
          nextSegmentIds: [`${polarity}-wire-${(index + 1) % boundaries.length}`],
        };
      });
      this.mainSegments[polarity] = list;
      this.segments.push(...list);
      for (const junction of configuration.junctions) {
        const splitIndex = boundaries.indexOf(junction.startRoadDistance);
        const mergeIndex = boundaries.indexOf(junction.endRoadDistance);
        const before = list[(splitIndex - 1 + list.length) % list.length]!;
        const direct = list[splitIndex]!;
        const merge = list[mergeIndex]!;
        const branchId = `${polarity}-${junction.id}-branch`;
        const start = path.positionAtRoadDistance(junction.startRoadDistance);
        const end = path.positionAtRoadDistance(junction.endRoadDistance);
        const startRoad = road.sample(junction.startRoadDistance);
        const endRoad = road.sample(junction.endRoadDistance);
        const branchControl = (position: Vec3, tangent: Vec3, direction: number): Vec3 => ({
          x:
            position.x +
            tangent.x * junction.controlLead * direction -
            tangent.z * junction.branchOffset,
          y: configuration.wireHeight,
          z:
            position.z +
            tangent.z * junction.controlLead * direction +
            tangent.x * junction.branchOffset,
        });
        const definition: CubicDefinition = {
          id: branchId,
          speedLimit: 3,
          points: [
            start,
            branchControl(start, startRoad.tangent, 1),
            branchControl(end, endRoad.tangent, -1),
            end,
          ],
        };
        const curve = new CubicBezier(definition);
        const branch: WireSegment = {
          id: branchId,
          startDistance: 0,
          length: curve.length,
          startNodeId: direct.startNodeId,
          endNodeId: merge.startNodeId,
          polarity,
          nextSegmentIds: [merge.id],
        };
        before.nextSegmentIds.push(branchId);
        this.segments.push(branch);
        this.branches.set(branchId, { curve, segment: branch });
        const routeSwitch: ContactSwitch = {
          id: `${polarity}-${junction.id}-switch`,
          nodeId: direct.startNodeId,
          incomingSegmentId: before.id,
          outgoingSegmentIds: [direct.id, branchId],
          routeBranchId: direct.id,
          actuation: junction.routeActuation,
        };
        if (selectRouteBranch(routeSwitch) !== direct.id)
          throw new Error(`Passenger circuit cannot follow depot edge at ${routeSwitch.id}.`);
        this.switches.push(routeSwitch);
      }
    }
  }

  wireLength(polarity: Polarity): number {
    return this.paths[polarity].length;
  }

  routeToWireDistance(distance: number, polarity: Polarity): number {
    return this.paths[polarity].fromRoadDistance(distance);
  }

  sample(distance: number, polarity: Polarity): PathSample {
    const path = this.paths[polarity];
    const wrapped = wrap(distance, path.length);
    const segment =
      this.mainSegments[polarity].find(
        (candidate) => wrapped < candidate.startDistance + candidate.length,
      ) ?? this.mainSegments[polarity][0]!;
    return path.sample(distance, segment.id);
  }

  sampleBranch(segmentId: string, localDistance: number): PathSample {
    const branch = this.branches.get(segmentId);
    if (!branch) {
      const segment = this.segments.find((candidate) => candidate.id === segmentId);
      if (!segment) throw new Error(`Unknown contact segment: ${segmentId}`);
      return this.sample(
        segment.startDistance + clamp(localDistance, 0, segment.length),
        segment.polarity,
      );
    }
    const t = branch.curve.parameterAtDistance(localDistance);
    const tangent = normalize3(branch.curve.derivative(t));
    return {
      position: branch.curve.position(t),
      tangent,
      yaw: Math.atan2(tangent.x, tangent.z),
      curvature: 0,
      segmentId,
    };
  }
}
