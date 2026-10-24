import * as THREE from 'three';

/** Extrude a longitudinal (z, y) outline across the vehicle's width. */
export function profileGeometry(
  points: readonly (readonly [number, number])[],
  width: number,
  bevel = 0,
) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => {
    if (index === 0) shape.moveTo(z, y);
    else shape.lineTo(z, y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 2,
    steps: 1,
    curveSegments: 1,
  });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  return geometry;
}

/** A convex face with deliberate hard edges, used for the faceted front mask. */
export function faceGeometry(points: readonly (readonly [number, number, number])[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  const indices: number[] = [];
  for (let index = 1; index < points.length - 1; index++) indices.push(0, index, index + 1);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Subtle panoramic curvature catches broad reflections without a dense mesh. */
export function windshieldGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const columns = 16,
    rows = 4;
  for (let row = 0; row <= rows; row++) {
    const v = row / rows;
    for (let column = 0; column <= columns; column++) {
      const u = (column / columns) * 2 - 1;
      const bottom = 1.42 + (Math.max(0, Math.abs(u) - 0.7) / 0.3) * 0.1;
      const y = THREE.MathUtils.lerp(bottom, 2.78, v);
      positions.push(
        u * THREE.MathUtils.lerp(1.075, 1.105, v),
        y,
        6.037 - (y - 1.42) * 0.146 + (1 - u * u) * 0.052,
      );
      if (row < rows && column < columns) {
        const index = row * (columns + 1) + column;
        indices.push(
          index,
          index + 1,
          index + columns + 1,
          index + 1,
          index + columns + 2,
          index + columns + 1,
        );
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
