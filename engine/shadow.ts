import * as THREE from 'three';

// Круглые «пятна» теней под объектами — дёшево и в духе ретро-игр.

const SHADOW_Y = 0.02;
const geometry = new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2);
const material = new THREE.MeshBasicMaterial({
  color: '#1a1c2c',
  transparent: true,
  opacity: 0.3,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
});

export function createBlobShadow(diameter: number): THREE.Mesh {
  const shadow = new THREE.Mesh(geometry, material);
  shadow.scale.set(diameter, 1, diameter);
  shadow.position.y = SHADOW_Y;
  return shadow;
}

/** Тени для множества неподвижных объектов — одним вызовом отрисовки. */
export function createShadowBatch(items: readonly { x: number; z: number; diameter: number }[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const matrix = new THREE.Matrix4();
  items.forEach((item, i) => {
    matrix.makeScale(item.diameter, 1, item.diameter).setPosition(item.x, SHADOW_Y, item.z);
    mesh.setMatrixAt(i, matrix);
  });
  mesh.computeBoundingSphere();
  return mesh;
}
