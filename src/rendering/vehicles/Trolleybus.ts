import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PoleContact, VehicleSnapshot } from '../../domain/types';
import {
  BODY_ROLL_PIVOT_HEIGHT,
  FRONT_AXLE,
  POLE_MOUNT,
  REAR_AXLE,
  WHEEL_RADIUS,
} from '../../domain/vehicles/VehicleGeometry';
import { faceGeometry, profileGeometry } from './bodyGeometry';

export interface TrolleybusVisual {
  group: THREE.Group;
  update(snapshot: VehicleSnapshot, selected: boolean, elapsed: number): void;
  dispose(): void;
}

type Wheel = { steering: THREE.Group; spinning: THREE.Group; front: boolean };
type DoorLeaf = { pivot: THREE.Group; direction: number };
type PoleVisual = {
  sections: THREE.Mesh[];
  joint: THREE.Mesh;
  shoe: THREE.Group;
  status: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
};

const UP = new THREE.Vector3(0, 1, 0);
const DOORS = [4.8, 0, -4.9];
const PASSENGER_PANELS = [
  [-5.77, -5.62],
  [-4.18, -0.72],
  [0.72, 4.08],
  [5.52, 5.62],
];
// Leave suspension travel above the tire when braking through a corner.
const ARCH_RADIUS = 0.69;
const ARCH_OUTER_RADIUS = 0.75;

/** A metre-scale, procedural Dnipro-inspired bus; local +Z is the front. */
export function createTrolleybus(id: string): TrolleybusVisual {
  // Poles are already solved in world coordinates by the contact simulation.
  const group = new THREE.Group();
  group.name = `trolleybus-${id}`;
  const chassis = new THREE.Group();
  group.add(chassis);
  // The sprung body rotates around the same low pivot as calculatePoleBase.
  const suspension = new THREE.Group();
  suspension.name = 'body-suspension';
  suspension.position.y = BODY_ROLL_PIVOT_HEIGHT;
  chassis.add(suspension);
  const body = new THREE.Group();
  body.position.y = -BODY_ROLL_PIVOT_HEIGHT;
  suspension.add(body);
  const textures: THREE.Texture[] = [];
  const wheels: Wheel[] = [];
  const doors: DoorLeaf[] = [];
  const standard = (color: THREE.ColorRepresentation, roughness = 0.62, metalness = 0.05) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const blue = standard('#168ed0', 0.48, 0.1);
  const blueLight = standard('#349fd9', 0.5, 0.08);
  const blueDark = standard('#1275ae', 0.5, 0.1);
  const black = standard('#172229', 0.7);
  const rubber = standard('#20272c', 0.94);
  const graphite = standard('#35424a', 0.64, 0.14);
  const silver = standard('#a9b4ba', 0.43, 0.55);
  const darkSilver = standard('#77868d', 0.6, 0.34);
  const ivory = standard('#e6ece4', 0.65);
  const yellow = standard('#e6b750', 0.57, 0.15);
  const glazing = new THREE.MeshStandardMaterial({
    color: '#263841',
    roughness: 0.3,
    metalness: 0.12,
    transparent: true,
    opacity: 0.78,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const windshield = glazing.clone();
  windshield.color.set('#18343f');
  windshield.opacity = 0.8;
  const headlight = new THREE.MeshStandardMaterial({
    color: '#fff4ce',
    emissive: '#ffe7a8',
    emissiveIntensity: 1.6,
    roughness: 0.4,
  });
  const tailLight = new THREE.MeshStandardMaterial({
    color: '#c73e2d',
    emissive: '#b8291f',
    emissiveIntensity: 0.45,
    roughness: 0.45,
  });
  const amber = new THREE.MeshStandardMaterial({
    color: '#edaa48',
    emissive: '#cf8124',
    emissiveIntensity: 0.35,
    roughness: 0.45,
  });

  const mesh = <G extends THREE.BufferGeometry>(
    geometry: G,
    material: THREE.Material,
    parent = body,
  ) => {
    const object = new THREE.Mesh(geometry, material);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent = body,
  ) => {
    const object = mesh(new THREE.BoxGeometry(width, height, depth), material, parent);
    object.position.set(x, y, z);
    return object;
  };
  const cylinder = (
    radius: number,
    length: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    parent = body,
    radialSegments = 12,
  ) => {
    const object = mesh(
      new THREE.CylinderGeometry(radius, radius, length, radialSegments),
      material,
      parent,
    );
    object.position.set(x, y, z);
    return object;
  };
  const rod = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    radius: number,
    material: THREE.Material,
    parent = body,
  ) => {
    const difference = end.clone().sub(start);
    const object = mesh(
      new THREE.CylinderGeometry(radius, radius, difference.length(), 7),
      material,
      parent,
    );
    object.position.copy(start).add(end).multiplyScalar(0.5);
    object.quaternion.setFromUnitVectors(UP, difference.normalize());
    return object;
  };
  const label = (
    width: number,
    height: number,
    draw: (context: CanvasRenderingContext2D) => void,
    materialOptions: { transparent?: boolean; emissive?: boolean } = {},
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.max(128, Math.round((1024 * height) / width));
    const context = canvas.getContext('2d');
    if (context) {
      context.scale(canvas.width / 1024, canvas.height / 256);
      draw(context);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    textures.push(texture);
    return new THREE.MeshBasicMaterial({
      map: texture,
      transparent: materialOptions.transparent ?? true,
      side: THREE.DoubleSide,
      toneMapped: !materialOptions.emissive,
      depthWrite: !materialOptions.transparent,
    });
  };
  const addPlane = (
    width: number,
    height: number,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
  ) => {
    const object = mesh(new THREE.PlaneGeometry(width, height), material);
    object.position.set(x, y, z);
    object.rotation.y = rotationY;
    object.castShadow = false;
    return object;
  };

  // A chamfered footprint gives the nose a softer silhouette than a box.
  const footprint = [
    [-1.12, -6],
    [1.12, -6],
    [1.275, -5.77],
    [1.275, 5.62],
    [1.08, 6],
    [-1.08, 6],
    [-1.275, 5.62],
    [-1.275, -5.77],
  ];
  const prism = (
    bottom: number,
    top: number,
    material: THREE.Material,
    inset = 0,
    openSides = false,
  ) => {
    const vertices: number[] = [];
    const indices: number[] = [];
    for (const y of [bottom, top]) {
      for (const [x, z] of footprint) vertices.push(x * (1 - inset), y, z);
    }
    for (let i = 0; i < footprint.length; i += 1) {
      if (openSides && (i === 2 || i === 6)) continue;
      const n = (i + 1) % footprint.length;
      indices.push(i, i + 8, n, n, i + 8, n + 8);
    }
    if (!openSides) {
      for (let i = 1; i < 7; i += 1) indices.push(8, 9 + i, 8 + i, 0, i, i + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, material);
  };
  prism(0.36, 1.39, blue, 0, true);
  // Real openings in the skirts: the tires are never painted over by a solid box.
  for (const side of [-1, 1]) {
    const panels = side === -1 ? PASSENGER_PANELS : [[-5.77, 5.62]];
    for (const [start, end] of panels) {
      const outline: [number, number][] = [[start, 0.36]];
      for (const axle of [REAR_AXLE, FRONT_AXLE]) {
        if (axle - ARCH_RADIUS <= start || axle + ARCH_RADIUS >= end) continue;
        outline.push([axle - ARCH_RADIUS, 0.36]);
        for (let step = 0; step <= 8; step++) {
          const angle = Math.PI - (step / 8) * Math.PI;
          outline.push([
            axle + Math.cos(angle) * ARCH_RADIUS,
            WHEEL_RADIUS + Math.sin(angle) * ARCH_RADIUS,
          ]);
        }
        outline.push([axle + ARCH_RADIUS, 0.36]);
      }
      outline.push([end, 0.36], [end, 1.39], [start, 1.39]);
      const panel = mesh(profileGeometry(outline, 0.085), blue);
      panel.position.x = side * 1.2375;
    }
  }
  prism(2.76, 3.01, blueLight);
  prism(2.97, 3.12, blue, 0.025);
  box(1.94, 0.12, 11.6, 0, 0.25, 0, graphite);
  box(1.94, 0.09, 11.4, 0, 0.345, 0, standard('#788080', 0.92));
  // Continuous high dark glazing and narrow framing, with a visible interior.
  for (const side of [-1, 1]) {
    box(0.065, 0.12, 11.45, side * 1.26, 2.74, -0.06, black);
    const panels = side === -1 ? PASSENGER_PANELS : [[-5.67, 5.57]];
    for (const [start, end] of panels) {
      const length = end - start;
      const center = (start + end) / 2;
      addPlane(length, 1.23, glazing, side * 1.28, 2.08, center, (side * Math.PI) / 2);
      box(0.06, 0.1, length, side * 1.27, 1.42, center, black);
      box(0.072, 0.035, length, side * 1.285, 2.42, center, graphite);
      box(0.05, 0.055, length, side * 1.29, 1.33, center, blueDark);
    }
    for (const z of [-5.62, -4.18, -2.35, -0.77, 0.77, 2.35, 4.08, 5.56]) {
      if (side === -1 && DOORS.some((center) => Math.abs(z - center) < 0.72)) continue;
      box(0.075, 1.29, 0.075, side * 1.28, 2.08, z, black);
    }
  }
  // Panoramic raked glass, a shallow V-shaped mask and angular blue cheeks.
  mesh(
    faceGeometry([
      [-1.1, 1.48, 6.02],
      [-0.76, 1.34, 6.04],
      [0, 1.22, 6.06],
      [0.76, 1.34, 6.04],
      [1.1, 1.48, 6.02],
      [1.1, 1.6, 6.01],
      [-1.1, 1.6, 6.01],
    ]),
    black,
  );
  mesh(
    faceGeometry([
      [-1.075, 1.52, 6.025],
      [-0.72, 1.42, 6.037],
      [0.72, 1.42, 6.037],
      [1.075, 1.52, 6.025],
      [1.105, 2.78, 5.838],
      [-1.105, 2.78, 5.838],
    ]),
    windshield,
  );
  box(2.18, 0.4, 0.035, 0, 2.57, 5.833, black).rotation.x = -0.132;
  for (const side of [-1, 1]) {
    const cornerGlass = mesh(
      faceGeometry([
        [side * 1.29, 1.47, 5.59],
        [side * 1.09, 1.5, 6.016],
        [side * 1.12, 2.78, 5.834],
        [side * 1.29, 2.73, 5.59],
      ]),
      windshield,
    );
    cornerGlass.castShadow = false;
    const pillar = box(0.1, 1.5, 0.105, side * 1.12, 2.07, 5.9, black);
    pillar.rotation.x = -0.132;
    box(0.49, 0.21, 0.045, side * 0.84, 0.64, 6.017, graphite);
    box(0.43, 0.155, 0.05, side * 0.84, 0.645, 6.044, silver);
    for (const xOffset of [-0.1, 0.09]) {
      const light = cylinder(0.061, 0.024, side * 0.84 + xOffset, 0.65, 6.077, headlight);
      light.rotation.x = Math.PI / 2;
    }
    box(0.14, 0.06, 0.025, side * 1.06, 1.16, 6.027, amber);
    rod(
      new THREE.Vector3(side * 1.08, 1.21, 6.018),
      new THREE.Vector3(side * 0.62, 0.99, 6.027),
      0.012,
      blueDark,
    );
    rod(
      new THREE.Vector3(side * 0.62, 0.99, 6.027),
      new THREE.Vector3(0, 0.96, 6.027),
      0.012,
      blueDark,
    );
    rod(
      new THREE.Vector3(side * 0.62, 1.44, 6.075),
      new THREE.Vector3(side * 0.3, 1.86, 5.995),
      0.014,
      graphite,
    );
    rod(
      new THREE.Vector3(side * 1.13, 2.71, 5.62),
      new THREE.Vector3(side * 1.57, 2.57, 5.78),
      0.031,
      graphite,
    );
    box(0.15, 0.48, 0.21, side * 1.57, 2.34, 5.8, black);
    box(0.021, 0.38, 0.16, side * 1.655, 2.34, 5.8, darkSilver);
  }
  box(1.16, 0.055, 0.045, 0, 0.39, 6.02, blueDark);
  box(0.53, 0.13, 0.025, 0, 0.65, 6.03, blueDark);
  const frontNumber = label(0.6, 0.19, (context) => {
    context.fillStyle = '#eef5e8';
    context.font = '500 210px sans-serif';
    context.textAlign = 'center';
    context.fillText(id, 512, 217);
  });
  addPlane(0.56, 0.19, frontNumber, -0.53, 1.17, 6.052);
  // Small original chevron badge.
  for (const side of [-1, 1]) {
    const badge = box(0.16, 0.036, 0.018, side * 0.058, 1.15, 6.055, silver);
    badge.rotation.z = side * 0.45;
  }
  const destination = label(
    1.98,
    0.33,
    (context) => {
      context.fillStyle = '#111c20';
      context.fillRect(0, 0, 1024, 256);
      context.fillStyle = '#ffbd53';
      context.font = '600 224px monospace';
      context.fillText('6', 24, 211);
      context.font = '600 68px sans-serif';
      context.fillText('ж/м ПРИДНІПРОВСЬКИЙ', 185, 105);
      context.fillText('ПЛОЩА СОБОРНА', 185, 193);
      context.fillStyle = 'rgba(0,0,0,.19)';
      for (let y = 0; y < 256; y += 8) context.fillRect(0, y, 1024, 2);
    },
    { transparent: false, emissive: true },
  );
  const frontDisplay = addPlane(1.98, 0.33, destination, 0, 2.58, 5.887);
  frontDisplay.rotation.x = -0.132;
  const sideDisplay = addPlane(1.75, 0.23, destination, -1.315, 2.52, 1.65, -Math.PI / 2);
  sideDisplay.renderOrder = 2;

  // Long sloping electrical fairings are the distinctive roof silhouette.
  mesh(
    profileGeometry(
      [
        [-0.05, 3.12],
        [3.75, 3.12],
        [3.45, 3.36],
        [3.1, 3.48],
        [0.32, 3.48],
        [0.08, 3.4],
      ],
      1.87,
    ),
    blue,
  );
  mesh(
    profileGeometry(
      [
        [0.3, 3.44],
        [2.98, 3.44],
        [2.7, 3.64],
        [0.64, 3.64],
      ],
      1.37,
    ),
    blueLight,
  );
  for (const side of [-1, 1]) {
    const fairing = mesh(
      profileGeometry(
        [
          [-1.65, 3.05],
          [5.62, 3.05],
          [5.35, 3.23],
          [4.9, 3.27],
          [4.25, 3.18],
          [3.62, 3.38],
          [3.2, 3.46],
          [-1.2, 3.46],
          [-1.48, 3.34],
        ],
        0.21,
      ),
      blueLight,
    );
    fairing.position.x = side * 1.01;
    const rearCover = mesh(
      profileGeometry(
        [
          [-5.62, 3.06],
          [-1.78, 3.06],
          [-1.92, 3.22],
          [-5.35, 3.22],
        ],
        0.17,
      ),
      blue,
    );
    rearCover.position.x = side * 1.02;
  }
  const hvac = mesh(
    profileGeometry(
      [
        [3.87, 3.12],
        [5.21, 3.12],
        [5.08, 3.35],
        [4.03, 3.35],
      ],
      1.43,
    ),
    ivory,
  );
  hvac.name = 'front-hvac';
  box(1.08, 0.045, 0.84, 0, 3.37, 4.54, silver);
  for (let i = 0; i < 7; i++) box(1.08, 0.018, 0.045, 0, 3.399, 4.23 + i * 0.1, graphite);
  for (const z of [-4.75, -2.5]) {
    box(0.8, 0.055, 0.68, 0, 3.153, z, darkSilver);
    box(0.69, 0.025, 0.57, 0, 3.193, z, silver);
  }
  const mountZ = POLE_MOUNT.longitudinal;
  box(1.42, 0.1, 1.12, 0, 3.19, mountZ - 0.12, graphite);
  for (const side of [-1, 1]) {
    const mountX = side * POLE_MOUNT.halfSpacing;
    cylinder(0.15, 0.12, mountX, 3.3, mountZ, ivory);
    box(0.2, 0.09, 0.4, mountX, POLE_MOUNT.height - 0.07, mountZ, darkSilver);
    rod(
      new THREE.Vector3(mountX, 3.31, mountZ - 0.47),
      new THREE.Vector3(mountX, POLE_MOUNT.height, mountZ),
      0.065,
      graphite,
    );
    for (const z of [-5.4, -1.95]) {
      rod(
        new THREE.Vector3(side * 0.83, 3.12, z),
        new THREE.Vector3(side * 0.83, 3.32, z),
        0.025,
        silver,
      );
    }
    rod(
      new THREE.Vector3(side * 0.83, 3.32, -5.4),
      new THREE.Vector3(side * 0.83, 3.32, -1.95),
      0.025,
      silver,
    );
  }

  // Three double doors on the passenger side, with inward-opening leaves.
  for (const center of DOORS) {
    box(0.08, 0.075, 1.44, -1.287, 2.715, center, black);
    box(0.08, 2.34, 0.055, -1.287, 1.55, center - 0.715, black);
    box(0.08, 2.34, 0.055, -1.287, 1.55, center + 0.715, black);
    box(0.28, 0.06, 1.43, -1.22, 0.38, center, yellow);
    for (const direction of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.name = 'door-leaf';
      pivot.position.set(-1.3, 0.4, center - direction * 0.66);
      body.add(pivot);
      const localZ = direction * 0.33;
      // Frame an actual glass opening, without an opaque slab behind it.
      const glass = mesh(new THREE.PlaneGeometry(0.55, 2.02), glazing, pivot);
      glass.rotation.y = -Math.PI / 2;
      glass.position.set(-0.01, 1.17, localZ);
      for (const edge of [-1, 1])
        box(0.07, 2.27, 0.045, 0, 1.135, localZ + edge * 0.3, black, pivot);
      box(0.07, 0.085, 0.65, 0, 2.23, localZ, black, pivot);
      box(0.074, 0.16, 0.65, -0.008, 0.1, localZ, black, pivot);
      box(0.075, 0.055, 0.65, -0.01, 0.018, localZ, yellow, pivot);
      box(0.075, 2.27, 0.037, -0.01, 1.135, direction * 0.635, black, pivot);
      rod(
        new THREE.Vector3(0.045, 0.82, localZ - direction * 0.2),
        new THREE.Vector3(0.045, 1.29, localZ + direction * 0.2),
        0.019,
        yellow,
        pivot,
      );
      doors.push({ pivot, direction });
    }
    cylinder(0.028, 2.08, -0.99, 1.58, center + 0.72, yellow);
  }

  // Dnipro's white wave, interrupted naturally by door cut-outs.
  for (const side of [-1, 1]) {
    const positions: number[] = [];
    const indices: number[] = [];
    const segments = 155;
    for (let i = 0; i <= segments; i += 1) {
      const z = -5.66 + (i / segments) * 11.27;
      const y = 0.64 + Math.sin(z * 3.2) * 0.075;
      positions.push(side * 1.283, y - 0.05, z, side * 1.283, y + 0.05, z);
      if (i < segments) {
        const middleZ = z + 11.27 / segments / 2;
        if (side === -1 && DOORS.some((door) => Math.abs(middleZ - door) < 0.77)) continue;
        if (
          Math.abs(middleZ - FRONT_AXLE) < ARCH_OUTER_RADIUS ||
          Math.abs(middleZ - REAR_AXLE) < ARCH_OUTER_RADIUS
        )
          continue;
        const start = i * 2;
        indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const waveMaterial = ivory.clone();
    waveMaterial.side = THREE.DoubleSide;
    mesh(geometry, waveMaterial);
    for (const z of [-5.72, -1.55, 1.24, 5.57])
      box(0.025, 0.065, 0.13, side * 1.293, 0.88, z, amber);
    // The repeating metal panel seams remain subtle at map scale.
    for (const z of [-4.04, -1.78, 1.05, 4.0])
      box(0.013, 0.57, 0.012, side * 1.285, 1.02, z, blueDark);
  }
  const branding = label(
    1.04,
    0.24,
    (context) => {
      context.fillStyle = '#e6f0ed';
      context.font = '500 184px sans-serif';
      context.textAlign = 'center';
      context.fillText('Дніпро', 512, 198);
    },
    { transparent: true },
  );
  const fleetNumber = label(
    0.5,
    0.18,
    (context) => {
      context.fillStyle = '#edf5e9';
      context.font = '500 210px sans-serif';
      context.textAlign = 'center';
      context.fillText(id, 512, 220);
    },
    { transparent: true },
  );
  for (const side of [-1, 1]) {
    addPlane(0.93, 0.2, branding, side * 1.336, 1.2, side === -1 ? -1.8 : 0, (side * Math.PI) / 2);
    addPlane(0.44, 0.16, fleetNumber, side * 1.338, 2.62, -5.3, (side * Math.PI) / 2);
  }

  // Rear black radiator, ladder, retrieval drums, stacked tail lamps.
  box(2.24, 1.37, 0.05, 0, 2.075, -5.997, black);
  box(0.55, 1.73, 0.12, 0, 1.72, -6.055, graphite);
  for (const side of [-1, 1]) {
    const rearCorner: [number, number, number][] = [
      [side * 1.278, 1.39, -5.67],
      [side * 1.12, 1.39, -6.015],
      [side * 1.12, 2.76, -6.015],
      [side * 1.278, 2.76, -5.67],
    ];
    mesh(faceGeometry(side === 1 ? rearCorner : rearCorner.reverse()), black);
    for (let i = 0; i < 6; i += 1) {
      const vent = box(0.52, 0.035, 0.035, side * 0.72, 1.81 + i * 0.095, -6.05, graphite);
      vent.rotation.z = side * -0.32;
    }
    rod(
      new THREE.Vector3(side * 0.28, 0.85, -6.18),
      new THREE.Vector3(side * 0.28, 3.16, -6.18),
      0.022,
      darkSilver,
    );
    const drum = cylinder(0.19, 0.07, side * 0.62, 1.13, -6.055, blueDark);
    drum.rotation.x = Math.PI / 2;
    for (let i = 0; i < 3; i += 1) {
      const lamp = cylinder(
        0.075,
        0.04,
        side * 1.02,
        0.78 + i * 0.18,
        -6.045,
        i === 1 ? amber : tailLight,
      );
      lamp.rotation.x = Math.PI / 2;
    }
    box(0.17, 0.08, 0.03, side * 0.98, 0.59, -6.03, tailLight);
    if (side === 1) {
      for (let i = 0; i < 5; i += 1)
        box(0.04, 0.045, 0.5, side * 1.31, 1.81 + i * 0.11, -5.25, graphite);
    }
  }
  for (let i = 0; i < 8; i += 1) box(0.56, 0.035, 0.035, 0, 0.94 + i * 0.28, -6.19, darkSilver);
  addPlane(0.5, 0.17, fleetNumber, -0.7, 1.53, -6.09, Math.PI);
  const backDisplay = addPlane(0.47, 0.3, destination, 0.65, 2.43, -6.049, Math.PI);
  backDisplay.scale.x = 0.82;

  // Interior: low floor, blue seats, warm handrails and a small driver's cab.
  const seatMaterial = standard('#426c7a', 0.94);
  for (const side of [-1, 1]) {
    for (const z of [-4.6, -3.6, -2.4, -1.4, 0.8, 1.8, 2.8]) {
      if (side === -1 && DOORS.some((center) => Math.abs(z - center) < 0.9)) continue;
      box(0.47, 0.11, 0.43, side * 0.84, 1.03, z, seatMaterial);
      box(0.47, 0.57, 0.095, side * 0.84, 1.29, z - 0.21, seatMaterial);
      box(0.06, 0.25, 0.06, side * 0.84, 0.87, z, graphite);
    }
    const handrailX = side === -1 ? -0.59 : 0.65;
    rod(
      new THREE.Vector3(handrailX, 2.61, -5.5),
      new THREE.Vector3(handrailX, 2.61, 4.65),
      0.02,
      yellow,
    );
    for (const z of [-3.4, -1.6, 1.1, 3.0]) cylinder(0.019, 1.88, side * 0.69, 1.71, z, yellow);
  }
  box(1.1, 0.34, 0.72, 0.52, 1.31, 5.42, graphite);
  box(0.63, 0.13, 0.61, 0.62, 1.08, 4.79, black);
  box(0.64, 0.64, 0.13, 0.62, 1.36, 4.49, black);
  const steeringWheel = mesh(new THREE.TorusGeometry(0.23, 0.025, 6, 14), black);
  steeringWheel.position.set(0.63, 1.55, 5.12);
  steeringWheel.rotation.x = -0.65;
  // Stylised driver visible through the panoramic windshield.
  const driverMaterial = standard('#354b5a', 0.9);
  const skinMaterial = standard('#b88c6c', 0.92);
  box(0.4, 0.57, 0.29, 0.62, 1.51, 4.83, driverMaterial);
  const head = mesh(new THREE.SphereGeometry(0.15, 8, 6), skinMaterial);
  head.position.set(0.62, 1.98, 4.87);
  rod(
    new THREE.Vector3(0.43, 1.7, 4.87),
    new THREE.Vector3(0.43, 1.54, 5.13),
    0.055,
    driverMaterial,
  );
  rod(
    new THREE.Vector3(0.8, 1.7, 4.87),
    new THREE.Vector3(0.81, 1.54, 5.13),
    0.055,
    driverMaterial,
  );

  // Wheels stay on the road while only the sprung body pitches and rolls.
  for (const z of [FRONT_AXLE, REAR_AXLE]) {
    for (const side of [-1, 1]) {
      const steering = new THREE.Group();
      steering.name = `${z === FRONT_AXLE ? 'front' : 'rear'}-wheel-${side}`;
      steering.position.set(side * 1.16, WHEEL_RADIUS, z);
      chassis.add(steering);
      const spinning = new THREE.Group();
      steering.add(spinning);
      const tire = cylinder(WHEEL_RADIUS, 0.36, 0, 0, 0, rubber, spinning, 20);
      tire.rotation.z = Math.PI / 2;
      const outerX = side * 0.194;
      const rim = cylinder(0.41, 0.027, outerX, 0, 0, darkSilver, spinning, 16);
      rim.rotation.z = Math.PI / 2;
      const hub = cylinder(0.19, 0.042, side * 0.22, 0, 0, silver, spinning);
      hub.rotation.z = Math.PI / 2;
      for (let hole = 0; hole < 8; hole += 1) {
        const angle = (hole / 8) * Math.PI * 2;
        const recess = cylinder(
          0.047,
          0.032,
          side * 0.214,
          Math.sin(angle) * 0.3,
          Math.cos(angle) * 0.3,
          graphite,
          spinning,
          8,
        );
        recess.rotation.z = Math.PI / 2;
      }
      const arch: [number, number][] = [[z - ARCH_OUTER_RADIUS, 0.35]];
      for (let step = 0; step <= 8; step++) {
        const angle = Math.PI - (step / 8) * Math.PI;
        arch.push([
          z + Math.cos(angle) * ARCH_OUTER_RADIUS,
          WHEEL_RADIUS + Math.sin(angle) * ARCH_OUTER_RADIUS,
        ]);
      }
      arch.push([z + ARCH_OUTER_RADIUS, 0.35], [z + ARCH_RADIUS, 0.35]);
      for (let step = 0; step <= 8; step++) {
        const angle = (step / 8) * Math.PI;
        arch.push([
          z + Math.cos(angle) * ARCH_RADIUS,
          WHEEL_RADIUS + Math.sin(angle) * ARCH_RADIUS,
        ]);
      }
      arch.push([z - ARCH_RADIUS, 0.35]);
      const wheelArch = mesh(profileGeometry(arch, 0.06), graphite);
      wheelArch.position.x = side * 1.29;
      wheels.push({ steering, spinning, front: z === FRONT_AXLE });
    }
  }

  const selectionMaterial = new THREE.MeshBasicMaterial({
    color: '#f6ca73',
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const selection = new THREE.Mesh(new THREE.RingGeometry(7.0, 7.055, 80), selectionMaterial);
  selection.rotation.x = -Math.PI / 2;
  selection.scale.x = 0.285;
  selection.position.y = 0.035;
  selection.visible = false;
  chassis.add(selection);

  const poleGroup = new THREE.Group();
  group.add(poleGroup);
  const poles: PoleVisual[] = [-1, 1].map(() => {
    const sections = [0, 1].map((index) =>
      mesh(
        new THREE.CylinderGeometry(index === 0 ? 0.033 : 0.024, index === 0 ? 0.041 : 0.033, 1, 8),
        index === 0 ? darkSilver : silver,
        poleGroup,
      ),
    );
    const joint = mesh(new THREE.SphereGeometry(0.07, 8, 6), black, poleGroup);
    const shoe = new THREE.Group();
    poleGroup.add(shoe);
    box(0.12, 0.08, 0.32, 0, 0, 0, graphite, shoe);
    box(0.065, 0.033, 0.23, 0, 0.052, 0, darkSilver, shoe);
    const statusMaterial = new THREE.MeshStandardMaterial({
      color: '#b8ead5',
      emissive: '#61b693',
      emissiveIntensity: 0.7,
    });
    const status = new THREE.Mesh(new THREE.SphereGeometry(0.037, 7, 5), statusMaterial);
    status.position.y = -0.06;
    shoe.add(status);
    return { sections, joint, shoe, status };
  });
  // Preserve detail without a draw call for every window mullion or handrail.
  const mergeStaticMeshes = (parent: THREE.Group) => {
    const batches = new Map<string, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (
        !(child instanceof THREE.Mesh) ||
        Array.isArray(child.material) ||
        child.material.transparent
      )
        continue;
      const key = `${child.material.uuid}:${Boolean(child.geometry.index)}:${Object.keys(child.geometry.attributes).sort().join(',')}`;
      const batch = batches.get(key) ?? [];
      batch.push(child);
      batches.set(key, batch);
    }
    for (const batch of batches.values()) {
      if (batch.length < 2) continue;
      const transformed = batch.map((object) => {
        object.updateMatrix();
        return object.geometry.clone().applyMatrix4(object.matrix);
      });
      const merged = mergeGeometries(transformed);
      transformed.forEach((geometry) => geometry.dispose());
      if (!merged) continue;
      mesh(merged, batch[0].material as THREE.Material, parent);
      batch.forEach((object) => {
        object.geometry.dispose();
        parent.remove(object);
      });
    }
  };
  mergeStaticMeshes(body);
  wheels.forEach((wheel) => mergeStaticMeshes(wheel.spinning));
  doors.forEach((door) => mergeStaticMeshes(door.pivot));
  const baseVector = new THREE.Vector3();
  const headVector = new THREE.Vector3();
  const directionVector = new THREE.Vector3();
  const updatePole = (visual: PoleVisual, contact: PoleContact) => {
    baseVector.set(contact.base.x, contact.base.y, contact.base.z);
    headVector.set(contact.head.x, contact.head.y, contact.head.z);
    directionVector.copy(headVector).sub(baseVector);
    const length = directionVector.length();
    poleGroup.visible = length > 0.01;
    directionVector.normalize();
    visual.sections.forEach((section, index) => {
      const start = index === 0 ? 0 : 0.56;
      const fraction = index === 0 ? 0.56 : 0.44;
      section.position
        .copy(baseVector)
        .addScaledVector(directionVector, length * (start + fraction / 2));
      section.quaternion.setFromUnitVectors(UP, directionVector);
      section.scale.y = length * fraction;
    });
    visual.joint.position.copy(baseVector);
    visual.shoe.position.copy(headVector);
    visual.shoe.rotation.y = Math.atan2(directionVector.x, directionVector.z);
    visual.status.material.color.set(contact.connected ? '#b8ead5' : '#f08a65');
    visual.status.material.emissive.set(contact.connected ? '#61b693' : '#e74e30');
  };

  return {
    group,
    update(snapshot, selected, elapsed) {
      chassis.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
      chassis.rotation.y = snapshot.yaw;
      suspension.rotation.set(snapshot.pitchAngle, 0, snapshot.rollAngle);
      for (const wheel of wheels) {
        wheel.steering.rotation.y = wheel.front ? snapshot.steeringAngle : 0;
        wheel.spinning.rotation.x = snapshot.totalDistance / WHEEL_RADIUS;
      }
      for (const door of doors) door.pivot.rotation.y = door.direction * snapshot.doorOpen * 1.42;
      selection.visible = selected;
      selectionMaterial.opacity = 0.68 + Math.sin(elapsed * 1.8) * 0.12;
      tailLight.emissiveIntensity = snapshot.acceleration < -0.15 ? 1.7 : 0.4;
      snapshot.poles.forEach((contact, index) => updatePole(poles[index], contact));
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      group.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry as THREE.BufferGeometry);
          const meshMaterials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          meshMaterials.forEach((material: THREE.Material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
      group.removeFromParent();
    },
  };
}
