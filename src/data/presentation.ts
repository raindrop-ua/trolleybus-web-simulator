/** Presentation-only settings, independent from simulation geometry and timing. */
export const CAMERA_SETTINGS = {
  overview: { span: 177, offset: { x: 180, y: 205, z: 245 } },
  // Orthographic framing is set by span. Stand back to keep foreground buildings
  // in front of the near plane when following a vehicle at close visual zoom.
  follow: { span: 43, offset: { x: 162, y: 168, z: 216 }, damping: 5 },
  minZoom: 0.45,
  maxZoom: 10,
};
export const CITY_SETTINGS = {
  seed: 246,
  treeCount: 150,
  buildingColors: ['#dbcaac', '#e6d9bf', '#c5cbb4', '#cbab94', '#e0cbb5', '#bfc9bf'],
};
export const LIGHTING_SETTINGS = {
  background: '#e5e9de',
  exposure: 1.02,
  hemisphereIntensity: 1.7,
  sunIntensity: 2.6,
};
