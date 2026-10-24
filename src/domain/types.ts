export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface PathSample {
  position: Vec3;
  tangent: Vec3;
  yaw: number;
  curvature: number;
  segmentId: string;
  /** Physical metres per reference-route metre; omitted for arc-length road paths. */
  distanceScale?: number;
}
export interface RoadSegment {
  id: string;
  startDistance: number;
  length: number;
  speedLimit: number;
  nextSegmentIds: string[];
}
export interface RoadPath {
  length: number;
  segments: RoadSegment[];
  sample(distance: number): PathSample;
}
export type Polarity = 'positive' | 'negative';
export interface WireSegment {
  id: string;
  startDistance: number;
  length: number;
  startNodeId: string;
  endNodeId: string;
  polarity: Polarity;
  nextSegmentIds: string[];
}
export interface ContactSwitch {
  id: string;
  nodeId: string;
  incomingSegmentId: string;
  outgoingSegmentIds: string[];
  routeBranchId: string;
  actuation: 'traction' | 'coasting';
}
export interface ContactNetwork {
  length: number;
  segments: WireSegment[];
  switches: ContactSwitch[];
  sample(distance: number, polarity: Polarity): PathSample;
  wireLength?(polarity: Polarity): number;
  routeToWireDistance?(roadDistance: number, polarity: Polarity): number;
  sampleBranch?(segmentId: string, localDistance: number): PathSample;
}
export interface PoleContact {
  base: Vec3;
  head: Vec3;
  wireDistance: number;
  wireSegmentId: string;
  connected: boolean;
  lengthError: number;
  wireError: number;
  diagnostic: string | null;
}
export interface StopDefinition {
  id: string;
  physicalId: string;
  name: string;
  shortName: string;
  distance: number;
  direction: 'outbound' | 'inbound';
  dwellSeconds: number;
}
export interface VehicleConfiguration {
  id: string;
  initialDistance: number;
  departureOffset: number;
  length: number;
  width: number;
  wheelbase: number;
  poleLength: number;
  maxSpeed: number;
  acceleration: number;
  braking: number;
}
export interface WorldDefinition {
  road: RoadPath;
  contact: ContactNetwork;
  stops: StopDefinition[];
  vehicles: VehicleConfiguration[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  startTime: number;
}
export type OperationalState =
  | 'driving'
  | 'braking'
  | 'doors-opening'
  | 'dwelling'
  | 'doors-closing'
  | 'waiting'
  | 'disconnected';
export interface DrivingCommand {
  traction: number;
  braking: number;
  steering: number;
  doorsRequestedOpen: boolean;
}
export interface VehicleSnapshot {
  id: string;
  distanceAlongRoute: number;
  totalDistance: number;
  /** Physical wheel travel, distinct from reference-route progress during a curb manoeuvre. */
  travelledDistance?: number;
  position: Vec3;
  yaw: number;
  speed: number;
  acceleration: number;
  steeringAngle: number;
  rollAngle: number;
  pitchAngle: number;
  doorOpen: number;
  operationalState: OperationalState;
  currentStopId: string | null;
  nextStopId: string;
  scheduleDeviationSeconds: number;
  passengers: number;
  completedLaps: number;
  roadSegmentId: string;
  poles: [PoleContact, PoleContact];
}
export interface StopEvent {
  vehicleId: string;
  stopId: string;
  kind: 'arrival' | 'departure';
  plannedTime: number;
  actualTime: number;
  deviation: number;
}
export interface DiagnosticEvent {
  time: number;
  vehicleId: string;
  message: string;
}
export interface SimulationSnapshot {
  time: number;
  elapsed: number;
  vehicles: VehicleSnapshot[];
  stopEvents: StopEvent[];
  diagnostics: DiagnosticEvent[];
}
