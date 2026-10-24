import * as THREE from 'three';
import {
  DOOR_LAYOUT,
  FRONT_AXLE,
  REAR_AXLE,
  WHEEL_RADIUS,
  WHEEL_ARCH_OUTER_RADIUS,
} from '../../domain/vehicles/VehicleGeometry';

/** Painted rear ribbons follow the lower panels and stop at doors and wheel openings. */
export function rearRibbonGeometry(side: number) {
  const vertices: number[] = [];
  const indices: number[] = [];
  const rows = 48;
  const stripeEdge = (center: number, y: number) => {
    const t = (y - 0.36) / 1.03;
    return center + 0.65 * Math.sin(t * Math.PI * 0.65);
  };
  for (const center of [-4.8, -3.1]) {
    for (let row = 0; row < rows; row++) {
      const bottom = 0.36 + (row / rows) * 1.03;
      const top = 0.36 + ((row + 1) / rows) * 1.03;
      const lower = stripeEdge(center, bottom);
      const upper = stripeEdge(center, top);
      let intervals = [[lower - 0.25, upper + 0.25]];
      const cut = (start: number, end: number) => {
        intervals = intervals.flatMap(([a, b]) => {
          if (end <= a || start >= b) return [[a, b]];
          return [a < start ? [a, start] : [], b > end ? [end, b] : []].filter(
            (interval) => interval.length === 2,
          );
        });
      };
      if (side === -1)
        for (const door of DOOR_LAYOUT)
          cut(door.center - door.width / 2 - 0.012, door.center + door.width / 2 + 0.012);
      const heightAboveAxle = Math.max(0, bottom - WHEEL_RADIUS);
      if (heightAboveAxle < WHEEL_ARCH_OUTER_RADIUS) {
        const half = Math.sqrt(WHEEL_ARCH_OUTER_RADIUS ** 2 - heightAboveAxle ** 2);
        for (const axle of [FRONT_AXLE, REAR_AXLE]) cut(axle - half, axle + half);
      }
      for (const [start, end] of intervals) {
        const a = Math.max(start, lower - 0.25),
          b = Math.min(end, lower + 0.25);
        const c = Math.max(start, upper - 0.25),
          d = Math.min(end, upper + 0.25);
        if (a >= b || c >= d) continue;
        const index = vertices.length / 3;
        vertices.push(
          side * 1.284,
          bottom,
          a,
          side * 1.284,
          bottom,
          b,
          side * 1.284,
          top,
          c,
          side * 1.284,
          top,
          d,
        );
        if (side === 1) indices.push(index, index + 2, index + 1, index + 1, index + 2, index + 3);
        else indices.push(index, index + 1, index + 2, index + 1, index + 3, index + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
