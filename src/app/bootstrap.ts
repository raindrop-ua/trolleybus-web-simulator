import { SimulationEngine } from '../simulation/SimulationEngine';
import { SceneRenderer } from '../rendering/SceneRenderer';
import { useUIStore } from '../state/useUIStore';
import { world } from './world';

/** Owns the app lifetime; React mounts this adapter, never the simulation tick. */
export function bootstrap(host: HTMLElement) {
  const engine = new SimulationEngine(world, 6);
  const scene = new SceneRenderer(host, world, {
    select: (id) => useUIStore.getState().select(id),
    follow: (id) => {
      useUIStore.getState().select(id);
      useUIStore.getState().setCamera('follow');
    },
    free: () => {
      if (useUIStore.getState().cameraMode !== 'free') useUIStore.getState().setCamera('free');
    },
    contextLost: (lost) =>
      useUIStore.setState({
        error: lost
          ? 'The graphics context is resting. Waiting for your browser to restore it…'
          : null,
      }),
    assetError: (message) => useUIStore.setState({ error: message }),
  });
  useUIStore.setState({ snapshot: engine.snapshot(), error: null });
  let previous = 0,
    lastPublish = 0,
    lastCameraRevision = -1,
    lastReset = useUIStore.getState().resetRevision;
  let frames = 0,
    fpsTime = 0;
  scene.start((time) => {
    const dt = previous ? Math.min((time - previous) / 1000, 0.25) : 0;
    previous = time;
    const state = useUIStore.getState();
    if (state.resetRevision !== lastReset) {
      engine.reset();
      lastReset = state.resetRevision;
    }
    engine.setPaused(state.paused);
    engine.setSpeed(state.speed);
    engine.advance(dt);
    const snapshot = engine.snapshot();
    if (state.cameraRevision !== lastCameraRevision) {
      scene.camera.setMode(
        state.cameraMode,
        snapshot.vehicles.find((v) => v.id === state.selectedId),
      );
      lastCameraRevision = state.cameraRevision;
    }
    scene.render(
      snapshot,
      { selectedId: state.selectedId, debug: import.meta.env.DEV && state.debug },
      dt,
    );
    frames++;
    fpsTime += dt;
    if (time - lastPublish > 100) {
      useUIStore.setState({
        snapshot,
        ...(fpsTime >= 1 ? { fps: Math.round(frames / fpsTime) } : {}),
      });
      lastPublish = time;
      if (fpsTime >= 1) {
        frames = 0;
        fpsTime = 0;
      }
    }
  });
  const key = (event: KeyboardEvent) => {
    if (
      event.target instanceof HTMLElement &&
      (['INPUT', 'TEXTAREA'].includes(event.target.tagName) || event.target.isContentEditable)
    )
      return;
    const state = useUIStore.getState();
    if (event.code === 'Space') {
      if (event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      state.togglePause();
    }
    if (event.code === 'Escape') {
      state.setCamera('overview');
      useUIStore.setState({ help: false });
    }
    if (event.code === 'KeyF') state.setCamera('follow');
    if (event.code === 'KeyD' && import.meta.env.DEV) state.toggleDebug();
    if (event.code === 'Digit1') state.setSpeed(1);
    if (event.code === 'Digit2') state.setSpeed(2);
    if (event.code === 'Digit4') state.setSpeed(4);
    if (event.code === 'Equal' || event.code === 'NumpadAdd') scene.camera.zoom(1.2);
    if (event.code === 'Minus' || event.code === 'NumpadSubtract') scene.camera.zoom(1 / 1.2);
  };
  window.addEventListener('keydown', key);
  if (import.meta.env.DEV)
    Object.assign(window, {
      __trolleybus: {
        snapshot: () => engine.snapshot(),
        renderStats: () => scene.statistics(),
        world,
      },
    });
  return () => {
    window.removeEventListener('keydown', key);
    if (import.meta.env.DEV) Reflect.deleteProperty(window, '__trolleybus');
    scene.dispose();
  };
}
