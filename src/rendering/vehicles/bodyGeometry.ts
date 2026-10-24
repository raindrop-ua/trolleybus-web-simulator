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

/** Closed blue 32100D front equipment cover, lofted across softly rounded sections. */
export function roofCowlGeometry() {
  const sections = [
    [3.65, 1.07, 3.13, 3.26],
    [3.87, 1.16, 3.15, 3.36],
    [4.25, 1.19, 3.17, 3.4],
    [4.85, 1.2, 3.16, 3.4],
    [5.25, 1.19, 3.13, 3.36],
    [5.65, 1.16, 3.08, 3.28],
    [5.87, 1.12, 3.05, 3.18],
    [6.015, 1.08, 3.04, 3.1],
  ];
  const vertices: number[] = [];
  const indices: number[] = [];
  const columns = 16;
  for (const [z, halfWidth, edge, crown] of sections) {
    for (let column = 0; column <= columns; column++) {
      const u = (column / columns) * 2 - 1;
      vertices.push(u * halfWidth, edge + (crown - edge) * Math.sqrt(1 - u ** 4), z);
    }
  }
  for (let row = 0; row < sections.length - 1; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
    }
  }
  // Close the ends and the side skirts down onto the existing roof deck.
  for (const row of [0, sections.length - 1]) {
    const [z] = sections[row];
    const center = vertices.length / 3;
    vertices.push(0, 3.02, z);
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      if (row === 0) indices.push(center, a, a + 1);
      else indices.push(center, a + 1, a);
    }
  }
  for (const column of [0, columns]) {
    for (let row = 0; row < sections.length - 1; row++) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      const bottom = vertices.length / 3;
      vertices.push(vertices[a * 3], 3.02, vertices[a * 3 + 2]);
      vertices.push(vertices[b * 3], 3.02, vertices[b * 3 + 2]);
      if (column === 0) indices.push(a, bottom, b, b, bottom, bottom + 1);
      else indices.push(a, b, bottom, b, bottom + 1, bottom);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** A shallow convex nose makes the painted front mask catch broad highlights. */
const frontPanelZ = (x: number, y: number) =>
  6 + (1 - (x / 1.08) ** 2) * 0.055 - Math.abs(y - 0.9) * 0.02;

/** The curved black V sits outside the painted nose, below the panoramic glass. */
export function frontMaskGeometry() {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let column = 0; column <= 24; column++) {
    const u = column / 12 - 1;
    const x = u * 1.1;
    const span = Math.abs(u);
    const bottom =
      1.075 + Math.min(span, 0.61) * (0.155 / 0.61) + Math.max(0, span - 0.61) * (0.25 / 0.39);
    for (const y of [bottom, 1.61]) vertices.push(x, y, frontPanelZ(x, y) + 0.025);
    if (column < 24) {
      const a = column * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function frontPanelGeometry() {
  const vertices: number[] = [],
    indices: number[] = [];
  const columns = 16,
    rows = 5;
  for (let row = 0; row <= rows; row++) {
    const y = THREE.MathUtils.lerp(0.36, 1.5, row / rows);
    for (let column = 0; column <= columns; column++) {
      const u = (column / columns) * 2 - 1;
      vertices.push(u * 1.08, y, frontPanelZ(u * 1.08, y));
      if (row < rows && column < columns) {
        const a = row * (columns + 1) + column;
        indices.push(a, a + 1, a + columns + 1, a + 1, a + columns + 2, a + columns + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
