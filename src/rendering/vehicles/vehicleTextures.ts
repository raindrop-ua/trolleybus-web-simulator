import * as THREE from 'three';
import atlasUrl from './assets/bkm32100d-surface-atlas.png';
import atlasLayout from './assets/bkm32100d-atlas-layout.json';

const ATLAS_SIZE = atlasLayout.size;
const REGIONS = atlasLayout.regions;

export type VehicleTextureRegion = keyof typeof REGIONS;

/** Fleet numbers use their own small texture; every other region shares one PNG. */
export function mapVehicleRegion<G extends THREE.BufferGeometry>(
  geometry: G,
  region: VehicleTextureRegion,
): G {
  const uv = geometry.getAttribute('uv');
  if (!uv) throw new Error('Vehicle atlas geometry needs UV coordinates.');
  if (region === 'fleet') return geometry;
  const [x, y, width, height] = REGIONS[region];
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(
      index,
      (x + 0.5 + uv.getX(index) * (width - 1)) / ATLAS_SIZE,
      1 - (y + height - 0.5 - uv.getY(index) * (height - 1)) / ATLAS_SIZE,
    );
  }
  uv.needsUpdate = true;
  return geometry;
}

/** A +Z-facing plane; all planes using the same material can be merged. */
export function createDecalGeometry(width: number, height: number, region: VehicleTextureRegion) {
  return mapVehicleRegion(new THREE.PlaneGeometry(width, height), region);
}

type SharedAtlas = { texture: THREE.Texture; users: number; disposed: boolean };
let sharedAtlas: SharedAtlas | undefined;

function acquireAtlas() {
  if (!sharedAtlas) {
    const texture = new THREE.TextureLoader().load(atlasUrl);
    texture.name = 'bkm32100d-shared-surface-atlas';
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const entry = { texture, users: 0, disposed: false };
    // Also tolerate a scene owner disposing all unique textures directly.
    texture.addEventListener('dispose', () => {
      entry.disposed = true;
      if (sharedAtlas === entry) sharedAtlas = undefined;
    });
    sharedAtlas = entry;
  }
  sharedAtlas.users++;
  return sharedAtlas;
}

function createFleetTexture(id: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot create the vehicle fleet number.');
  context.fillStyle = '#edf4ee';
  context.font = '500 83px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(id, canvas.width / 2, canvas.height / 2 + 2, canvas.width - 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `vehicle-fleet-number-${id}`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** One checked-in 1024² PNG for the fleet, plus a 256 × 96 number per vehicle. */
export function createVehicleTextures(id: string) {
  const atlas = acquireAtlas();
  const texture = atlas.texture;
  const fleetTexture = createFleetTexture(id);
  const material = new THREE.MeshStandardMaterial({
    name: 'vehicle-surface-atlas',
    map: texture,
    roughness: 0.68,
    metalness: 0.18,
    alphaTest: 0.3,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const decalMaterial = new THREE.MeshBasicMaterial({
    name: 'vehicle-marking-atlas',
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const fleetMaterial = decalMaterial.clone();
  fleetMaterial.name = `vehicle-fleet-number-${id}`;
  fleetMaterial.map = fleetTexture;
  const displayMaterial = new THREE.MeshBasicMaterial({
    name: 'vehicle-display-atlas',
    map: texture,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  let disposed = false;
  return {
    texture,
    fleetTexture,
    material,
    decalMaterial,
    fleetMaterial,
    displayMaterial,
    dispose() {
      if (disposed) return;
      disposed = true;
      material.dispose();
      decalMaterial.dispose();
      fleetMaterial.dispose();
      displayMaterial.dispose();
      fleetTexture.dispose();
      atlas.users--;
      if (atlas.users === 0 && !atlas.disposed) atlas.texture.dispose();
    },
  };
}
