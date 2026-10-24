import * as THREE from 'three';

/** Small repeatable surface maps; no downloaded assets or per-frame work. */
export function surfaceTexture(kind: 'asphalt' | 'paving') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(128, 128);
  let seed = kind === 'asphalt' ? 1927 : 831;
  for (let index = 0; index < pixels.data.length; index += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const variation = Math.floor((seed / 4294967296) * 17) - 8;
    const base = kind === 'asphalt' ? [116, 127, 124] : [216, 211, 192];
    for (let channel = 0; channel < 3; channel++)
      pixels.data[index + channel] = base[channel] + variation;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  if (kind === 'paving') {
    context.strokeStyle = '#b9b9a9';
    context.lineWidth = 1;
    for (let row = 0; row < 4; row++) {
      context.beginPath();
      context.moveTo(0, row * 32 + 0.5);
      context.lineTo(128, row * 32 + 0.5);
      for (let column = -1; column < 4; column++) {
        const x = column * 64 + (row % 2) * 32 + 0.5;
        context.moveTo(x, row * 32);
        context.lineTo(x, row * 32 + 32);
      }
      context.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
