import type { CubicDefinition } from '../core/geometry/CubicBezier';
import {
  OverheadContactNetwork,
  type ContactNetworkConfiguration,
} from '../domain/overhead/ContactNetwork';
import { RoadNetwork } from '../domain/roads/RoadNetwork';
import type { StopDefinition, Vec3, WorldDefinition } from '../domain/types';

// Mirror the drawing convention so model doors at local -x face the outer curb.
const point = (x: number, z: number): Vec3 => ({ x, y: 0, z: -z });
const cubic = (id: string, points: [Vec3, Vec3, Vec3, Vec3], speedLimit = 10): CubicDefinition => ({
  id,
  points,
  speedLimit,
});
const quarter = 0.5522847498;

export const CONTACT_DEFINITION: ContactNetworkConfiguration = {
  wireHeight: 6.2,
  halfSeparation: 0.35,
  junctions: [
    {
      id: 'depot',
      startRoadDistance: 18,
      endRoadDistance: 42,
      branchOffset: 9,
      controlLead: 8,
      routeActuation: 'coasting',
    },
  ],
};

/** A compact ~0.75 km miniature, rather than a literal 5 km geographic map. */
export const ROAD_DEFINITIONS: CubicDefinition[] = [
  cubic('outbound-station', [
    point(-125, -3.5),
    point(-110, -3.5),
    point(-95, -3.5),
    point(-80, -3.5),
  ]),
  cubic('outbound-square', [point(-80, -3.5), point(-65, -3.5), point(-50, 8), point(-35, 8)], 8),
  cubic('outbound-university', [point(-35, 8), point(-8, 8), point(18, 8), point(45, 8)]),
  cubic('outbound-riverside', [point(45, 8), point(63, 8), point(82, -3.5), point(100, -3.5)], 8),
  cubic(
    'outbound-park',
    [point(100, -3.5), point(108, -3.5), point(117, -3.5), point(125, -3.5)],
    7,
  ),
  cubic(
    'east-loop-entry',
    [point(125, -3.5), point(136, -3.5), point(139, -20), point(150, -20)],
    4,
  ),
  cubic(
    'east-loop-outer-a',
    [point(150, -20), point(150 + 20 * quarter, -20), point(170, -20 * quarter), point(170, 0)],
    4,
  ),
  cubic(
    'east-loop-outer-b',
    [point(170, 0), point(170, 20 * quarter), point(150 + 20 * quarter, 20), point(150, 20)],
    4,
  ),
  cubic('east-loop-exit', [point(150, 20), point(139, 20), point(136, 3.5), point(125, 3.5)], 4),
  cubic('inbound-park', [point(125, 3.5), point(117, 3.5), point(108, 3.5), point(100, 3.5)], 7),
  cubic('inbound-riverside', [point(100, 3.5), point(82, 3.5), point(63, 15), point(45, 15)], 8),
  cubic('inbound-university', [point(45, 15), point(18, 15), point(-8, 15), point(-35, 15)]),
  cubic('inbound-square', [point(-35, 15), point(-50, 15), point(-65, 3.5), point(-80, 3.5)], 8),
  cubic('inbound-station', [point(-80, 3.5), point(-95, 3.5), point(-110, 3.5), point(-125, 3.5)]),
  cubic(
    'west-loop-entry',
    [point(-125, 3.5), point(-136, 3.5), point(-139, 20), point(-150, 20)],
    4,
  ),
  cubic(
    'west-loop-outer-a',
    [point(-150, 20), point(-150 - 20 * quarter, 20), point(-170, 20 * quarter), point(-170, 0)],
    4,
  ),
  cubic(
    'west-loop-outer-b',
    [point(-170, 0), point(-170, -20 * quarter), point(-150 - 20 * quarter, -20), point(-150, -20)],
    4,
  ),
  cubic(
    'west-loop-exit',
    [point(-150, -20), point(-139, -20), point(-136, -3.5), point(-125, -3.5)],
    4,
  ),
];

export function createWorldDefinition(): WorldDefinition {
  const road = new RoadNetwork(ROAD_DEFINITIONS);
  const distance = (id: string, offset: number): number =>
    road.segments.find((segment) => segment.id === id)!.startDistance + offset;
  const stop = (
    physicalId: string,
    name: string,
    shortName: string,
    direction: 'outbound' | 'inbound',
    at: number,
    dwellSeconds: number,
  ): StopDefinition => ({
    id: `${physicalId}-${direction}`,
    physicalId,
    name,
    shortName,
    distance: at,
    direction,
    dwellSeconds,
  });
  const stops = [
    stop('station', 'Railway Station', 'Station', 'outbound', 12, 14),
    stop('square', 'Central Square', 'Square', 'outbound', distance('outbound-square', 13), 12),
    stop(
      'university',
      'University',
      'University',
      'outbound',
      distance('outbound-university', 33),
      15,
    ),
    stop('riverside', 'Riverside', 'Riverside', 'outbound', distance('outbound-riverside', 29), 10),
    stop('park', 'Park', 'Park', 'outbound', distance('outbound-park', 17), 16),
    stop('park', 'Park', 'Park', 'inbound', distance('inbound-park', 8), 14),
    stop('riverside', 'Riverside', 'Riverside', 'inbound', distance('inbound-riverside', 29), 10),
    stop(
      'university',
      'University',
      'University',
      'inbound',
      distance('inbound-university', 47),
      13,
    ),
    stop('square', 'Central Square', 'Square', 'inbound', distance('inbound-square', 31), 12),
    stop('station', 'Railway Station', 'Station', 'inbound', distance('inbound-station', 33), 16),
  ];
  return {
    road,
    contact: new OverheadContactNetwork(road, CONTACT_DEFINITION),
    stops,
    vehicles: ['2001', '2002', '2003'].map((id, index) => ({
      id,
      initialDistance: (index * road.length) / 3,
      departureOffset: index * 8,
      length: 12,
      width: 2.55,
      wheelbase: 6,
      poleLength: 7.8,
      maxSpeed: 10,
      acceleration: 1.15,
      braking: 1.65,
    })),
    bounds: { minX: -220, maxX: 220, minZ: -140, maxZ: 140 },
    startTime: 7 * 3600 + 24 * 60,
  };
}
