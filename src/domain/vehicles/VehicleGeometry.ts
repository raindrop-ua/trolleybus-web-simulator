/** Shared body-local geometry keeps the visible roof mounts and contact solver aligned. */
export const POLE_MOUNT = {
  halfSpacing: 0.38,
  height: 3.43,
  longitudinal: -0.65,
} as const;

/** Suspension rotates the body above the axles; the wheel/chassis frame stays on the road. */
export const BODY_ROLL_PIVOT_HEIGHT = 0.8;

export const FRONT_AXLE = 3.1;
export const REAR_AXLE = -2.9;
export const WHEEL_RADIUS = 0.49;
// Leave suspension travel even when braking and cornering together.
export const WHEEL_ARCH_RADIUS = 0.62;
export const WHEEL_ARCH_OUTER_RADIUS = 0.67;

export interface DoorLayout {
  readonly id: 'front' | 'middle' | 'rear';
  readonly center: number;
  readonly width: number;
}

/** The narrower rear opening leaves a full equipment bay aft of the passenger doors. */
export const DOOR_LAYOUT = [
  { id: 'front', center: 4.8, width: 1.44 },
  { id: 'middle', center: 0, width: 1.44 },
  { id: 'rear', center: -4.4, width: 1.24 },
] as const satisfies readonly DoorLayout[];

export const REAR_EQUIPMENT_BAY = { front: -5.02, rear: -6 } as const;
