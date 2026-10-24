import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** One small, prefiltered reflection map for the entire fleet; no per-frame probes. */
export function createVehicleEnvironment(renderer: THREE.WebGLRenderer) {
  const room = new RoomEnvironment();
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(room, 0.08, 0.1, 100, { size: 128 });
  room.dispose();
  generator.dispose();
  return target;
}
