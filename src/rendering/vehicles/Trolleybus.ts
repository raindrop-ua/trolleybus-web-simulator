import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { PoleContact, VehicleSnapshot } from '../../domain/types';
import {
  BODY_ROLL_PIVOT_HEIGHT,
  FRONT_AXLE,
  POLE_MOUNT,
  REAR_AXLE,
  WHEEL_RADIUS,
  DOOR_LAYOUT,
  REAR_EQUIPMENT_BAY,
  WHEEL_ARCH_RADIUS as ARCH_RADIUS,
  WHEEL_ARCH_OUTER_RADIUS as ARCH_OUTER_RADIUS,
} from '../../domain/vehicles/VehicleGeometry';
import { faceGeometry, profileGeometry, windshieldGeometry } from './bodyGeometry';
import {
  createVehicleTextures,
  createDecalGeometry,
  type VehicleTextureRegion,
} from './vehicleTextures';

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
  retrieval: THREE.Mesh;
  side: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const sortedDoors = [...DOOR_LAYOUT].sort((a, b) => a.center - b.center);
const PASSENGER_PANELS = sortedDoors.map((door, index) => [
  index === 0 ? -5.77 : sortedDoors[index - 1].center + sortedDoors[index - 1].width / 2,
  door.center - door.width / 2,
]);
PASSENGER_PANELS.push([5.52, 5.62]);
const inDoor = (z: number, margin = 0) =>
  DOOR_LAYOUT.some((door) => Math.abs(z - door.center) < door.width / 2 + margin);

/** A metre-scale, procedural Dnipro-inspired bus; local +Z is the front. */
export function createTrolleybus(id: string, environment?: THREE.Texture): TrolleybusVisual {
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
  const surfaces = createVehicleTextures(id);
  surfaces.material.envMap = environment ?? null;
  surfaces.material.envMapIntensity = 0.25;
  const textures: THREE.Texture[] = [surfaces.texture];
  const wheels: Wheel[] = [];
  const doors: DoorLeaf[] = [];
  const standard = (color: THREE.ColorRepresentation, roughness = 0.62, metalness = 0.05) =>
    new THREE.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      envMap: environment,
      envMapIntensity: 0.2 + metalness * 0.8,
    });
  const paint = (color: string) =>
    new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.38,
      metalness: 0.12,
      clearcoat: 0.28,
      clearcoatRoughness: 0.24,
      envMap: environment,
      envMapIntensity: 0.3,
    });
  const blue = paint('#0879c0');
  const blueLight = paint('#168bcc');
  const blueDark = paint('#08649c');
  const black = standard('#172229', 0.7);
  const rubber = standard('#20272c', 0.94);
  const graphite = standard('#35424a', 0.64, 0.14);
  const silver = standard('#a9b4ba', 0.43, 0.55);
  const darkSilver = standard('#77868d', 0.6, 0.34);
  const ivory = standard('#e6ece4', 0.65);
  const yellow = standard('#e6b750', 0.57, 0.15);
  const glazing = new THREE.MeshStandardMaterial({
    color: '#172e3b',
    roughness: 0.16,
    metalness: 0.15,
    envMap: environment,
    envMapIntensity: 0.4,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    side: THREE.DoubleSide,
    forceSinglePass: true,
  });
  const windshield = glazing.clone();
  windshield.color.set('#18343f');
  windshield.opacity = 0.86;
  const lampLens = (name: string, color: string, intensity: number) => {
    const material = surfaces.material.clone();
    material.name = name;
    material.emissive.set(color);
    material.emissiveMap = surfaces.texture;
    material.emissiveIntensity = intensity;
    material.roughness = 0.4;
    material.metalness = 0.05;
    return material;
  };
  const headlightLens = lampLens('headlight-lens', '#fff4d4', 0.85);
  const brakeLens = lampLens('brake-lens', '#ff4b35', 0.4);
  const amberLens = lampLens('amber-lens', '#ffc56a', 0.35);
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
    object.castShadow = material !== glazing && material !== windshield;
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
  const roundedBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    parent = body,
    radius = 0.035,
  ) => {
    const object = mesh(
      new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)),
      mat,
      parent,
    );
    object.position.set(x, y, z);
    return object;
  };
  const decal = (
    w: number,
    h: number,
    region: VehicleTextureRegion,
    x: number,
    y: number,
    z: number,
    rotationY = 0,
    kind: 'decal' | 'surface' | 'display' = 'decal',
    parent = body,
  ) => {
    const mat =
      kind === 'surface'
        ? surfaces.material
        : kind === 'display'
          ? surfaces.displayMaterial
          : surfaces.decalMaterial;
    const object = mesh(createDecalGeometry(w, h, region), mat, parent);
    object.position.set(x, y, z);
    object.rotation.y = rotationY;
    object.castShadow = false;
    object.userData.mergeable = true;
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
    const panels = side === -1 ? PASSENGER_PANELS : [[REAR_EQUIPMENT_BAY.front, 5.57]];
    for (const [rawStart, end] of panels) {
      const start = Math.max(rawStart, REAR_EQUIPMENT_BAY.front);
      if (end - start < 0.04) continue;
      const length = end - start;
      const center = (start + end) / 2;
      addPlane(length, 1.23, glazing, side * 1.28, 2.08, center, (side * Math.PI) / 2);
      box(0.06, 0.1, length, side * 1.27, 1.42, center, black);
      box(0.072, 0.035, length, side * 1.285, 2.42, center, graphite);
      box(0.05, 0.055, length, side * 1.29, 1.33, center, blueDark);
    }
    for (const z of [-5.02, -3.78, -2.1, -0.77, 0.77, 2.35, 4.08, 5.56]) {
      if (side === -1 && inDoor(z)) continue;
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
  mesh(windshieldGeometry(), windshield);
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
    roundedBox(0.52, 0.23, 0.04, side * 0.84, 0.65, 6.005, graphite);
    roundedBox(0.46, 0.175, 0.025, side * 0.84, 0.65, 6.02, silver);
    // Reflector detail lives in the atlas; the visible lens emits the light.
    decal(0.46, 0.175, 'headlamp', side * 0.84, 0.65, 6.038, 0, 'surface').material = headlightLens;
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
      new THREE.Vector3(side * 0.62, 1.44, 6.09),
      new THREE.Vector3(side * 0.3, 1.86, 6.05),
      0.014,
      graphite,
    );
    rod(
      new THREE.Vector3(side * 0.3, 1.86, 6.05),
      new THREE.Vector3(side * 0.76, 1.64, 6.06),
      0.021,
      black,
    );
    rod(
      new THREE.Vector3(side * 1.13, 2.71, 5.62),
      new THREE.Vector3(side * 1.57, 2.57, 5.78),
      0.031,
      graphite,
    );
    roundedBox(0.16, 0.49, 0.23, side * 1.57, 2.34, 5.8, black);
    roundedBox(0.022, 0.39, 0.17, side * 1.658, 2.34, 5.8, darkSilver);
    const hinge = cylinder(0.052, 0.08, side * 1.13, 2.7, 5.62, black);
    hinge.rotation.x = Math.PI / 2;
  }
  box(1.16, 0.055, 0.045, 0, 0.39, 6.02, blueDark);
  box(0.53, 0.13, 0.025, 0, 0.65, 6.03, blueDark);
  decal(0.56, 0.19, 'fleet', -0.53, 1.17, 6.052);
  decal(0.42, 0.13, 'accessibility', 0.64, 1.18, 6.056);
  decal(0.25, 0.17, 'makerBadge', 0, 1.13, 6.079);
  decal(0.52, 0.16, 'serviceNotice', 0.65, 1.6, 6.043);
  roundedBox(2.07, 0.13, 0.1, 0, 0.43, 5.99, blueDark, body, 0.04);
  for (const x of [-0.54, 0.54]) {
    cylinder(0.025, 0.028, x, 0.93, 6.045, black).rotation.x = Math.PI / 2;
  }
  // Small original chevron badge.
  for (const side of [-1, 1]) {
    const badge = box(0.16, 0.036, 0.018, side * 0.058, 1.15, 6.055, silver);
    badge.rotation.z = side * 0.45;
  }
  const frontDisplay = decal(1.98, 0.33, 'destination', 0, 2.58, 5.944, 0, 'display');
  frontDisplay.rotation.x = -0.132;
  decal(1.75, 0.23, 'destination', -1.315, 2.52, 1.65, -Math.PI / 2, 'display');

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
      0.04,
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
      0.035,
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
        0.025,
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
        0.02,
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
      0.03,
    ),
    ivory,
  );
  hvac.name = 'front-hvac';
  roundedBox(1.12, 0.045, 0.88, 0, 3.38, 4.54, silver);
  const hvacGrille = decal(1.03, 0.79, 'perforated', 0, 3.406, 4.54, 0, 'surface');
  hvacGrille.rotation.x = -Math.PI / 2;
  for (const x of [-0.32, 0.32]) {
    const fan = mesh(new THREE.TorusGeometry(0.22, 0.016, 5, 20), darkSilver);
    fan.position.set(x, 3.413, 4.54);
    fan.rotation.x = -Math.PI / 2;
  }
  for (const z of [-4.75, -2.5]) {
    box(0.8, 0.055, 0.68, 0, 3.153, z, darkSilver);
    box(0.69, 0.025, 0.57, 0, 3.193, z, silver);
    const hatch = decal(0.68, 0.56, 'roofPanel', 0, 3.21, z);
    hatch.rotation.x = -Math.PI / 2;
  }
  const mountZ = POLE_MOUNT.longitudinal;
  box(1.42, 0.1, 1.12, 0, 3.19, mountZ - 0.12, graphite);
  for (const side of [-1, 1]) {
    const mountX = side * POLE_MOUNT.halfSpacing;
    cylinder(0.15, 0.12, mountX, 3.3, mountZ, ivory);
    for (let rib = 0; rib < 4; rib++)
      cylinder(0.17, 0.016, mountX, 3.258 + rib * 0.029, mountZ, ivory);
    box(0.2, 0.09, 0.4, mountX, POLE_MOUNT.height - 0.07, mountZ, darkSilver);
    rod(
      new THREE.Vector3(mountX, 3.31, mountZ - 0.47),
      new THREE.Vector3(mountX, POLE_MOUNT.height, mountZ),
      0.065,
      graphite,
    );
    // Tension spring, cable gland and grounded roof conduit stay with the body.
    const springPoints = Array.from({ length: 49 }, (_, i) => {
      const angle = (i / 48) * Math.PI * 12;
      return new THREE.Vector3(
        mountX + Math.cos(angle) * 0.06,
        3.29 + Math.sin(angle) * 0.06,
        mountZ - 0.65 + (i / 48) * 0.4,
      );
    });
    mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(springPoints), 48, 0.013, 5, false),
      darkSilver,
    );
    rod(
      new THREE.Vector3(mountX, 3.24, mountZ - 0.7),
      new THREE.Vector3(mountX, 3.18, -5.15),
      0.022,
      black,
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
  for (const { center, width, id: doorId } of DOOR_LAYOUT) {
    const half = width / 2;
    const hinge = half - 0.06;
    const leafWidth = hinge - 0.01;
    box(0.08, 0.075, width, -1.287, 2.715, center, black);
    box(0.08, 2.34, 0.055, -1.287, 1.55, center - half + 0.005, black);
    box(0.08, 2.34, 0.055, -1.287, 1.55, center + half - 0.005, black);
    box(0.28, 0.06, width - 0.01, -1.22, 0.38, center, yellow);
    for (const direction of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.name = `door-${doorId}-${direction}`;
      pivot.position.set(-1.3, 0.4, center - direction * hinge);
      body.add(pivot);
      const localZ = (direction * hinge) / 2;
      // Frame an actual glass opening, without an opaque slab behind it.
      const glass = mesh(new THREE.PlaneGeometry(leafWidth - 0.1, 2.02), glazing, pivot);
      glass.rotation.y = -Math.PI / 2;
      glass.position.set(-0.01, 1.17, localZ);
      for (const edge of [-1, 1])
        box(0.07, 2.27, 0.045, 0, 1.135, localZ + edge * (leafWidth / 2 - 0.025), black, pivot);
      box(0.07, 0.085, leafWidth, 0, 2.23, localZ, black, pivot);
      box(0.074, 0.16, leafWidth, -0.008, 0.1, localZ, black, pivot);
      box(0.075, 0.055, leafWidth, -0.01, 0.018, localZ, yellow, pivot);
      box(0.075, 2.27, 0.037, -0.01, 1.135, direction * (hinge - 0.025), black, pivot);
      decal(
        leafWidth - 0.14,
        0.14,
        'doorLabel',
        -0.043,
        0.35,
        localZ,
        -Math.PI / 2,
        'decal',
        pivot,
      );
      rod(
        new THREE.Vector3(0.045, 0.82, localZ - direction * 0.2),
        new THREE.Vector3(0.045, 1.29, localZ + direction * 0.2),
        0.019,
        yellow,
        pivot,
      );
      doors.push({ pivot, direction });
    }
    cylinder(0.028, 2.08, -0.99, 1.58, center + half, yellow);
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
        if (side === -1 && inDoor(middleZ, 0.05)) continue;
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
    for (const z of [-3.85, -1.78, 1.05, 4.0]) {
      if (side === -1 && inDoor(z)) continue;
      box(0.013, 0.57, 0.012, side * 1.285, 1.02, z, blueDark);
    }
  }
  for (const side of [-1, 1]) {
    decal(0.93, 0.2, 'branding', side * 1.294, 1.2, side === -1 ? -1.8 : 0, (side * Math.PI) / 2);
    decal(0.4, 0.13, 'fleet', side * 1.294, 2.66, -5.43, (side * Math.PI) / 2);
  }

  // The rear door ends before a full-width, solid electrical compartment.
  const bayCenter = (REAR_EQUIPMENT_BAY.front + REAR_EQUIPMENT_BAY.rear) / 2;
  roundedBox(2.36, 2.29, 0.94, 0, 1.56, bayCenter, graphite, body, 0.05);
  for (const side of [-1, 1]) {
    const turn = (side * Math.PI) / 2;
    roundedBox(0.07, 1.18, 0.66, side * 1.255, 2.01, -5.43, black);
    decal(0.62, 1.13, 'louver', side * 1.296, 2.01, -5.43, turn, 'surface');
    decal(0.66, 0.83, 'servicePanel', side * 1.295, 0.93, -5.43, turn);
    decal(0.51, 0.24, 'louver', side * 1.297, 0.93, -5.43, turn, 'surface');
    decal(0.12, 0.14, 'highVoltage', side * 1.3, 1.23, -5.4, turn);
    for (const z of [-1.58, 1.38]) {
      decal(1.16, 0.7, 'servicePanel', side * 1.293, 0.95, z, turn);
    }
    // Wheel-adjacent access catches and slim rub strips below the glass belt.
    for (const z of [-1.95, 1.68])
      roundedBox(0.024, 0.045, 0.15, side * 1.305, 1.23, z, darkSilver, body, 0.008);
  }

  // Rear black radiator, ladder, retrieval drums, stacked tail lamps.
  box(2.24, 1.37, 0.05, 0, 2.075, -5.997, black);
  box(0.55, 1.73, 0.12, 0, 1.72, -6.055, graphite);
  decal(0.24, 0.27, 'highVoltage', 0, 1.91, -6.122, Math.PI);
  decal(0.25, 0.18, 'technicalPlate', -0.35, 0.59, -6.035, Math.PI);
  decal(0.48, 0.16, 'accessibility', -0.65, 0.44, -6.033, Math.PI);
  roundedBox(2.12, 0.12, 0.08, 0, 0.39, -6.01, blueDark);
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
    const drumLip = mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 24), darkSilver);
    drumLip.position.set(side * 0.62, 1.13, -6.101);
    decal(0.51, 0.32, 'louver', side * 0.64, 0.68, -6.035, Math.PI, 'surface');
    decal(0.52, 0.61, 'servicePanel', side * 0.65, 1.05, -6.037, Math.PI);
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
      decal(
        0.15,
        0.15,
        i === 1 ? 'amberLamp' : 'tailLamp',
        side * 1.02,
        0.78 + i * 0.18,
        -6.069,
        Math.PI,
        'surface',
      ).material = i === 1 ? amberLens : brakeLens;
    }
    box(0.17, 0.08, 0.03, side * 0.98, 0.59, -6.03, tailLight);
  }
  for (let i = 0; i < 8; i += 1) box(0.56, 0.035, 0.035, 0, 0.94 + i * 0.28, -6.19, darkSilver);
  decal(0.5, 0.17, 'fleet', -0.7, 1.53, -6.09, Math.PI);
  decal(0.34, 0.3, 'routeNumber', 0.65, 2.43, -6.049, Math.PI, 'display');

  // Interior: low floor, blue seats, warm handrails and a small driver's cab.
  const seatMaterial = standard('#426c7a', 0.94);
  for (const side of [-1, 1]) {
    for (const z of [-4.6, -3.6, -2.4, -1.4, 0.8, 1.8, 2.8]) {
      if (side === -1 && inDoor(z, 0.25)) continue;
      const seatY = [FRONT_AXLE, REAR_AXLE].some((axle) => Math.abs(z - axle) < 0.9) ? 1.29 : 0.94;
      roundedBox(0.47, 0.11, 0.43, side * 0.84, seatY, z, seatMaterial);
      roundedBox(0.47, 0.57, 0.095, side * 0.84, seatY + 0.26, z - 0.21, seatMaterial);
      roundedBox(0.5, 0.61, 0.075, side * 0.84, seatY + 0.26, z - 0.27, graphite);
      box(0.06, seatY - 0.445, 0.06, side * 0.84, (seatY + 0.335) / 2, z, graphite);
    }
    const handrailX = side === -1 ? -0.59 : 0.65;
    rod(
      new THREE.Vector3(handrailX, 2.61, -4.9),
      new THREE.Vector3(handrailX, 2.61, 4.65),
      0.02,
      yellow,
    );
    for (const z of [-3.4, -1.6, 1.1, 3.0]) cylinder(0.019, 1.88, side * 0.69, 1.71, z, yellow);
    for (const z of [-1.7, 1.4, 2.3]) {
      const handle = mesh(new THREE.TorusGeometry(0.09, 0.014, 5, 12, Math.PI * 1.7), yellow);
      handle.position.set(handrailX, 2.42, z);
      handle.rotation.y = Math.PI / 2;
      rod(
        new THREE.Vector3(handrailX, 2.5, z),
        new THREE.Vector3(handrailX, 2.62, z),
        0.016,
        black,
      );
    }
  }
  roundedBox(1.1, 0.34, 0.72, 0.52, 1.31, 5.42, graphite);
  roundedBox(0.32, 0.18, 0.07, 0.95, 1.58, 5.4, black);
  for (let i = 0; i < 5; i++)
    box(0.035, 0.015, 0.045, 0.84 + i * 0.045, 1.49, 5.25, i === 0 ? amber : darkSilver);
  const cabScreen = decal(0.25, 0.11, 'routeNumber', 0.95, 1.59, 5.358, Math.PI, 'display');
  cabScreen.rotation.x = 0.15;
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
      const tireProfile = [
        [0.35, -0.17],
        [0.46, -0.18],
        [0.53, -0.14],
        [WHEEL_RADIUS, -0.075],
        [WHEEL_RADIUS, 0.075],
        [0.53, 0.14],
        [0.46, 0.18],
        [0.35, 0.17],
        [0.35, -0.17],
      ].map(([radius, depth]) => new THREE.Vector2(radius, depth));
      const tire = mesh(new THREE.LatheGeometry(tireProfile, 32), rubber, spinning);
      tire.rotation.z = Math.PI / 2;
      if (z === REAR_AXLE) {
        const innerTire = mesh(tire.geometry.clone(), rubber, spinning);
        innerTire.rotation.z = Math.PI / 2;
        innerTire.position.x = -side * 0.36;
      }
      // A dished rim, raised lip and ten lug nuts read at close follow distance.
      const outerX = side * 0.17;
      const rim = cylinder(0.385, 0.045, outerX, 0, 0, darkSilver, spinning, 32);
      rim.rotation.z = Math.PI / 2;
      const rimLip = mesh(new THREE.TorusGeometry(0.375, 0.023, 6, 32), silver, spinning);
      rimLip.rotation.y = Math.PI / 2;
      rimLip.position.x = side * 0.2;
      const hub = cylinder(
        z === FRONT_AXLE ? 0.14 : 0.2,
        z === FRONT_AXLE ? 0.055 : 0.12,
        side * 0.23,
        0,
        0,
        silver,
        spinning,
        24,
      );
      hub.rotation.z = Math.PI / 2;
      for (let hole = 0; hole < 10; hole += 1) {
        const angle = (hole / 10) * Math.PI * 2;
        const recess = cylinder(
          0.043,
          0.012,
          side * 0.199,
          Math.sin(angle) * 0.285,
          Math.cos(angle) * 0.285,
          graphite,
          spinning,
          8,
        );
        recess.rotation.z = Math.PI / 2;
        const bolt = cylinder(
          0.021,
          0.025,
          side * 0.27,
          Math.sin(angle) * 0.19,
          Math.cos(angle) * 0.19,
          darkSilver,
          spinning,
          6,
        );
        bolt.rotation.z = Math.PI / 2;
      }
      decal(
        1.09,
        1.09,
        'tireSidewall',
        side * 0.188,
        0,
        0,
        (side * Math.PI) / 2,
        'decal',
        spinning,
      );
      for (const offset of [-0.07, 0.07]) {
        const tread = mesh(
          new THREE.TorusGeometry(WHEEL_RADIUS - 0.006, 0.007, 4, 32),
          black,
          spinning,
        );
        tread.rotation.y = Math.PI / 2;
        tread.position.x = offset;
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
  const poles: PoleVisual[] = [-1, 1].map((side) => {
    const sections = [0, 1].map((index) =>
      mesh(
        new THREE.CylinderGeometry(index === 0 ? 0.033 : 0.024, index === 0 ? 0.041 : 0.033, 1, 8),
        index === 0 ? darkSilver : silver,
        poleGroup,
      ),
    );
    const joint = mesh(new THREE.SphereGeometry(0.07, 8, 6), black, poleGroup);
    const retrieval = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 5), black, poleGroup);
    retrieval.castShadow = false;
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
    return { sections, joint, shoe, status, retrieval, side };
  });
  // Preserve detail without a draw call for every window mullion or handrail.
  const mergeStaticMeshes = (parent: THREE.Group) => {
    const batches = new Map<string, THREE.Mesh[]>();
    for (const child of parent.children) {
      if (
        !(child instanceof THREE.Mesh) ||
        Array.isArray(child.material) ||
        (child.material.transparent && !child.userData.mergeable)
      )
        continue;
      const key = `${child.material.uuid}:${child.castShadow}:${child.receiveShadow}:${Boolean(child.geometry.index)}:${Object.keys(child.geometry.attributes).sort().join(',')}`;
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
      const combined = mesh(merged, batch[0].material as THREE.Material, parent);
      combined.castShadow = batch[0].castShadow;
      combined.receiveShadow = batch[0].receiveShadow;
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
  const drumVector = new THREE.Vector3();
  const ropeVector = new THREE.Vector3();
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
    drumVector.set(visual.side * 0.62, 1.13, -6.11);
    body.localToWorld(drumVector);
    ropeVector.copy(headVector).addScaledVector(directionVector, -0.18).sub(drumVector);
    visual.retrieval.position.copy(drumVector).addScaledVector(ropeVector, 0.5);
    visual.retrieval.scale.y = ropeVector.length();
    visual.retrieval.quaternion.setFromUnitVectors(UP, ropeVector.normalize());
  };

  return {
    group,
    update(snapshot, selected, elapsed) {
      chassis.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
      chassis.rotation.y = snapshot.yaw;
      suspension.rotation.set(snapshot.pitchAngle, 0, snapshot.rollAngle);
      body.updateWorldMatrix(true, false);
      for (const wheel of wheels) {
        wheel.steering.rotation.y = wheel.front ? snapshot.steeringAngle : 0;
        wheel.spinning.rotation.x = snapshot.totalDistance / WHEEL_RADIUS;
      }
      for (const door of doors) door.pivot.rotation.y = door.direction * snapshot.doorOpen * 1.42;
      selection.visible = selected;
      selectionMaterial.opacity = 0.68 + Math.sin(elapsed * 1.8) * 0.12;
      tailLight.emissiveIntensity = snapshot.acceleration < -0.15 ? 1.7 : 0.4;
      brakeLens.emissiveIntensity = tailLight.emissiveIntensity;
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
