export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function wrap(value: number, length: number): number {
  return ((value % length) + length) % length;
}

/** Equivalent wrapped value nearest to an unwrapped previous position. */
export function unwrapNear(value: number, previous: number, length: number): number {
  return value + Math.round((previous - value) / length) * length;
}
