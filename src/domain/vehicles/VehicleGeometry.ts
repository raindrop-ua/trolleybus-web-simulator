/** Shared body-local geometry keeps the visible roof mounts and contact solver aligned. */
export const POLE_MOUNT = {
  halfSpacing: 0.38,
  height: 3.43,
  longitudinal: -0.65,
} as const;

/** Suspension rotates the body above the axles; the wheel/chassis frame stays on the road. */
export const BODY_ROLL_PIVOT_HEIGHT = 0.8;

export const FRONT_AXLE = 3.1;
export const REAR_AXLE = -3.2;
export const WHEEL_RADIUS = 0.56;
