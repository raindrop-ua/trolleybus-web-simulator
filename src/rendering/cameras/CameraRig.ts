import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CameraMode } from '../../state/useUIStore';
import type { VehicleSnapshot } from '../../domain/types';
import { CAMERA_SETTINGS } from '../../data/presentation';
import { ROUTE_SCALE } from '../../data/layout';

export class CameraRig {
  readonly camera = new THREE.OrthographicCamera(-150, 150, 100, -100, 0.1, 1600 * ROUTE_SCALE);
  readonly controls: OrbitControls;
  private mode: CameraMode = 'overview';
  private span = CAMERA_SETTINGS.overview.span;
  private aspect = 1;
  private target = new THREE.Vector3(0, 0, 0);
  private offset = new THREE.Vector3().copy(CAMERA_SETTINGS.overview.offset);
  constructor(canvas: HTMLCanvasElement) {
    this.controls = new OrbitControls(this.camera, canvas);
    this.camera.position.copy(this.offset);
    this.controls.target.copy(this.target);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.minZoom = CAMERA_SETTINGS.minZoom;
    this.controls.maxZoom = CAMERA_SETTINGS.maxZoom;
    this.controls.minPolarAngle = 0.12;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.12;
    this.controls.update();
  }
  resize(width: number, height: number) {
    this.aspect = width / height;
    this.setFrustum();
  }
  setMode(mode: CameraMode, selected?: VehicleSnapshot) {
    this.mode = mode;
    if (mode === 'free') return;
    this.camera.zoom = 1;
    const settings = mode === 'follow' ? CAMERA_SETTINGS.follow : CAMERA_SETTINGS.overview;
    this.span = settings.span;
    this.offset.copy(settings.offset);
    this.target.set(
      selected && mode === 'follow' ? selected.position.x : 0,
      0,
      selected && mode === 'follow' ? selected.position.z : 0,
    );
    this.controls.target.copy(this.target);
    this.camera.position.copy(this.target).add(this.offset);
    this.setFrustum();
    this.controls.update();
  }
  update(selected: VehicleSnapshot | undefined, dt: number) {
    if (this.mode === 'follow' && selected) {
      const next = new THREE.Vector3(selected.position.x, 1.4, selected.position.z);
      const previous = this.controls.target.clone();
      this.controls.target.lerp(next, 1 - Math.exp(-dt * CAMERA_SETTINGS.follow.damping));
      this.camera.position.add(this.controls.target.clone().sub(previous));
    }
    this.controls.update();
  }
  zoom(factor: number) {
    this.camera.zoom = THREE.MathUtils.clamp(
      this.camera.zoom * factor,
      CAMERA_SETTINGS.minZoom,
      CAMERA_SETTINGS.maxZoom,
    );
    this.camera.updateProjectionMatrix();
  }
  private setFrustum() {
    const half = this.span / 2;
    this.camera.left = -half * this.aspect;
    this.camera.right = half * this.aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }
  dispose() {
    this.controls.dispose();
  }
}
