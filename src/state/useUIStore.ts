import { create } from 'zustand';
import type { SimulationSnapshot } from '../domain/types';

export type CameraMode = 'overview' | 'follow' | 'free';
interface UIState {
  snapshot: SimulationSnapshot | null;
  paused: boolean;
  speed: 1 | 2 | 4;
  selectedId: string;
  cameraMode: CameraMode;
  cameraRevision: number;
  debug: boolean;
  help: boolean;
  fleetOpen: boolean;
  fps: number;
  error: string | null;
  resetRevision: number;
  select(id: string): void;
  setCamera(mode: CameraMode): void;
  togglePause(): void;
  setSpeed(speed: 1 | 2 | 4): void;
  toggleDebug(): void;
  toggleHelp(): void;
  toggleFleet(): void;
  reset(): void;
}
export const useUIStore = create<UIState>()((set) => ({
  snapshot: null,
  paused: false,
  speed: 1,
  selectedId: '2001',
  cameraMode: 'overview',
  cameraRevision: 0,
  debug: false,
  help: false,
  fleetOpen: true,
  fps: 60,
  error: null,
  resetRevision: 0,
  select: (id) => set({ selectedId: id }),
  setCamera: (mode) => set((s) => ({ cameraMode: mode, cameraRevision: s.cameraRevision + 1 })),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setSpeed: (speed) => set({ speed }),
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
  toggleHelp: () => set((s) => ({ help: !s.help })),
  toggleFleet: () => set((s) => ({ fleetOpen: !s.fleetOpen })),
  reset: () => set((s) => ({ resetRevision: s.resetRevision + 1, paused: false, speed: 1 })),
}));
