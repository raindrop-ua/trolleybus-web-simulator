import * as THREE from 'three';

export const material = (color: THREE.ColorRepresentation, roughness = 0.92) =>
  new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });

export function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  mat: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function rod(
  parent: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  radius: number,
  mat: THREE.Material,
) {
  const delta = to.clone().sub(from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 5), mat);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  parent.add(mesh);
  return mesh;
}

export function labelTexture(
  text: string,
  foreground = '#344a4a',
  background = '#f7f4e7',
  width = 512,
  height = 96,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = foreground;
  ctx.font = `600 ${height * 0.39}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2, width - 30);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type Instance = { position: THREE.Vector3; scale: THREE.Vector3; yaw: number; color: THREE.Color };
export class Batch {
  private instances: Instance[] = [];
  constructor(
    private geometry: THREE.BufferGeometry,
    private mat: THREE.Material,
  ) {}
  add(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    color: THREE.ColorRepresentation,
    yaw = 0,
  ) {
    this.instances.push({
      position: new THREE.Vector3(x, y, z),
      scale: new THREE.Vector3(sx, sy, sz),
      yaw,
      color: new THREE.Color(color),
    });
  }
  build(parent: THREE.Object3D, shadows = true) {
    if (!this.instances.length) return;
    const mesh = new THREE.InstancedMesh(this.geometry, this.mat, this.instances.length);
    const dummy = new THREE.Object3D();
    this.instances.forEach((instance, i) => {
      dummy.position.copy(instance.position);
      dummy.scale.copy(instance.scale);
      dummy.rotation.set(0, instance.yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, instance.color);
    });
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    parent.add(mesh);
  }
}
