import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import vehicleUrl from './assets/bkm32100d.glb?url';

type Entry = { scene: Promise<THREE.Group>; users: number };
let cached: Entry | undefined;

function disposeTemplate(scene: THREE.Group) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const list = Array.isArray(object.material) ? object.material : [object.material];
    list.forEach((material) => {
      materials.add(material);
      for (const value of Object.values(material))
        if (value instanceof THREE.Texture) textures.add(value);
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  const images = new Set<unknown>();
  textures.forEach((texture) => {
    texture.dispose();
    images.add(texture.image);
  });
  for (const image of images)
    if (image && typeof (image as ImageBitmap).close === 'function') (image as ImageBitmap).close();
}

/** Shared immutable GLB geometry; visuals own cloned motion nodes and materials. */
export function acquireVehicleAsset() {
  if (!cached) {
    const entry: Entry = {
      scene: new GLTFLoader().loadAsync(vehicleUrl).then((gltf) => gltf.scene),
      users: 0,
    };
    cached = entry;
    void entry.scene.catch(() => {
      if (cached === entry) cached = undefined;
    });
  }
  const entry = cached;
  entry.users++;
  let released = false;
  return {
    scene: entry.scene,
    release() {
      if (released) return;
      released = true;
      entry.users--;
      if (entry.users === 0) {
        if (cached === entry) cached = undefined;
        void entry.scene.then(disposeTemplate, () => undefined);
      }
    },
  };
}
