import * as THREE from 'three';
import type { SimulationSnapshot, WorldDefinition } from '../domain/types';
import { createCity } from './environment/City';
import { createRoadScene } from './environment/RoadScene';
import { createTrolleybus, type TrolleybusVisual } from './vehicles/Trolleybus';
import { OverheadScene } from './overhead/OverheadScene';
import { CameraRig } from './cameras/CameraRig';
import { LIGHTING_SETTINGS } from '../data/presentation';
import { createVehicleEnvironment } from './vehicles/vehicleEnvironment';

export interface ViewState {
  selectedId: string;
  debug: boolean;
}
export interface SceneCallbacks {
  select(id: string): void;
  follow(id: string): void;
  free(): void;
  contextLost(lost: boolean): void;
}

export class SceneRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: CameraRig;
  private scene = new THREE.Scene();
  private buses = new Map<string, TrolleybusVisual>();
  private overhead: OverheadScene;
  private resizeObserver: ResizeObserver;
  private raycaster = new THREE.Raycaster();
  private pointerDown = { x: 0, y: 0 };
  private cleanup: (() => void)[] = [];
  private vehicleEnvironment: THREE.WebGLRenderTarget;
  private vehicleEnvironmentDisposed = false;

  constructor(host: HTMLElement, world: WorldDefinition, callbacks: SceneCallbacks) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = LIGHTING_SETTINGS.exposure;
    this.vehicleEnvironment = createVehicleEnvironment(this.renderer);
    const canvas = this.renderer.domElement;
    canvas.setAttribute(
      'aria-label',
      'Interactive 3D miniature of Dnipro trolleybus route 6. Drag to orbit, scroll to zoom.',
    );
    canvas.setAttribute('role', 'img');
    host.appendChild(canvas);
    this.scene.background = new THREE.Color(LIGHTING_SETTINGS.background);
    this.scene.add(
      new THREE.HemisphereLight('#fff9e6', '#a3b9a4', LIGHTING_SETTINGS.hemisphereIntensity),
    );
    const sunlight = new THREE.DirectionalLight('#fff0d3', LIGHTING_SETTINGS.sunIntensity);
    sunlight.position.set(-90, 180, 85);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.camera.left = -250;
    sunlight.shadow.camera.right = 250;
    sunlight.shadow.camera.top = 210;
    sunlight.shadow.camera.bottom = -210;
    sunlight.shadow.camera.far = 550;
    sunlight.shadow.normalBias = 0.09;
    sunlight.shadow.bias = -0.00015;
    this.scene.add(sunlight);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(3000, 3000),
      new THREE.MeshStandardMaterial({ color: LIGHTING_SETTINGS.background, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -8;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.scene.add(createCity(world), createRoadScene(world));
    this.overhead = new OverheadScene(world);
    this.scene.add(this.overhead.group);
    for (const config of world.vehicles) {
      const visual = createTrolleybus(config.id, this.vehicleEnvironment.texture);
      visual.group.userData.vehicleId = config.id;
      this.buses.set(config.id, visual);
      this.scene.add(visual.group);
    }
    this.camera = new CameraRig(canvas);
    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      this.renderer.setSize(width, height);
      this.camera.resize(width, height);
    };
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(host);
    resize();
    const pick = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      this.raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        this.camera.camera,
      );
      const hits = this.raycaster.intersectObjects(
        [...this.buses.values()].map((b) => b.group),
        true,
      );
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (typeof obj.userData.vehicleId === 'string') return obj.userData.vehicleId as string;
          obj = obj.parent;
        }
      }
      return undefined;
    };
    const down = (event: PointerEvent) => {
      this.pointerDown = { x: event.clientX, y: event.clientY };
    };
    const up = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 5)
        return;
      const id = pick(event);
      if (id) callbacks.select(id);
    };
    const move = (event: PointerEvent) => {
      if (
        event.buttons &&
        Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 5
      )
        callbacks.free();
    };
    const wheel = () => callbacks.free();
    const double = (event: MouseEvent) => {
      const id = pick(event);
      if (id) callbacks.follow(id);
    };
    const lost = (event: Event) => {
      event.preventDefault();
      // Release the target through Three's old GL bookkeeping while it still
      // owns the lost context. Old GPU handles cannot be deleted after restore.
      if (!this.vehicleEnvironmentDisposed) {
        this.vehicleEnvironment.dispose();
        this.vehicleEnvironmentDisposed = true;
      }
      callbacks.contextLost(true);
    };
    const restored = () => {
      // Three registers its synchronous restoration listener in its constructor,
      // before this listener. Its GL state is ready when we regenerate the PMREM.
      const previousEnvironment = this.vehicleEnvironment;
      const restoredEnvironment = createVehicleEnvironment(this.renderer);
      const materials = new Set<THREE.Material>();
      this.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
        const objectMaterials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        objectMaterials.forEach((material) => materials.add(material));
      });
      for (const material of materials) {
        if ('envMap' in material && material.envMap === previousEnvironment.texture) {
          material.envMap = restoredEnvironment.texture;
          material.needsUpdate = true;
        }
      }
      this.vehicleEnvironment = restoredEnvironment;
      this.vehicleEnvironmentDisposed = false;
      callbacks.contextLost(false);
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('wheel', wheel, { passive: true });
    canvas.addEventListener('dblclick', double);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('dblclick', double);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
    });
  }
  start(tick: (time: number) => void) {
    this.renderer.setAnimationLoop(tick);
  }
  statistics() {
    return {
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      programs: this.renderer.info.programs?.length ?? 0,
      pixelRatio: this.renderer.getPixelRatio(),
    };
  }
  render(snapshot: SimulationSnapshot, state: ViewState, dt: number) {
    for (const vehicle of snapshot.vehicles)
      this.buses
        .get(vehicle.id)
        ?.update(vehicle, vehicle.id === state.selectedId, snapshot.elapsed);
    this.overhead.update(snapshot.vehicles, state.debug);
    this.camera.update(
      snapshot.vehicles.find((v) => v.id === state.selectedId),
      dt,
    );
    this.renderer.render(this.scene, this.camera.camera);
  }
  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.cleanup.forEach((fn) => fn());
    this.camera.dispose();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
        if (object instanceof THREE.InstancedMesh) object.dispose();
        geometries.add(object.geometry);
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        for (const mat of mats) {
          materials.add(mat);
          for (const value of Object.values(mat))
            if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    geometries.forEach((g) => g.dispose());
    textures.delete(this.vehicleEnvironment.texture);
    textures.forEach((t) => t.dispose());
    materials.forEach((m) => m.dispose());
    if (!this.vehicleEnvironmentDisposed) {
      this.vehicleEnvironment.dispose();
      this.vehicleEnvironmentDisposed = true;
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
