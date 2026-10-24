import * as THREE from 'three';

/** Extrude a longitudinal (z, y) outline across the vehicle's width. */
export function profileGeometry(points: readonly (readonly [number, number])[], width: number) {
  const shape = new THREE.Shape();
  points.forEach(([z, y], index) => {
    if (index === 0) shape.moveTo(z, y);
    else shape.lineTo(z, y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: width,
    bevelEnabled: false,
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
