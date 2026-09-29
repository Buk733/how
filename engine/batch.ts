import * as THREE from 'three';
import type { SpriteSheet } from './sprite';

/** Один неподвижный спрайт в пачке: где стоит, какой кадр и насколько крупный. */
export interface BatchItem {
  readonly x: number;
  readonly z: number;
  /** Высота точки привязки над землёй (по умолчанию 0 — стоит на земле). */
  readonly y?: number;
  /** Кадр листа: номер в ряду и ряд. */
  readonly column?: number;
  readonly row?: number;
  /** Во сколько раз крупнее обычного размера листа. */
  readonly scale?: number;
  /** Отразить по горизонтали. */
  readonly flip?: boolean;
}

// Каждый угол сдвигается в пространстве камеры, как у THREE.Sprite: картинка всегда смотрит на камеру.
const vertexShader = /* glsl */ `
  attribute vec2 corner;
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    mvPosition.xy += corner;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    vec4 texel = texture2D(map, vUv);
    if (texel.a < 0.5) discard;
    gl_FragColor = vec4(texel.rgb, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/**
 * Много неподвижных спрайтов-билбордов одного листа — одним вызовом отрисовки.
 * Выглядят так же, как THREE.Sprite (стоят на земле и смотрят на камеру), но тысяча деревьев
 * рисуется как одна сетка. Двигать отдельные спрайты нельзя — для этого есть BillboardSprite.
 */
export function createBillboardBatch(sheet: SpriteSheet, items: readonly BatchItem[]): THREE.Mesh {
  const count = items.length;
  const positions = new Float32Array(count * 12);
  const corners = new Float32Array(count * 8);
  const uvs = new Float32Array(count * 8);
  const indices = new Uint32Array(count * 6);
  const baseWidth = sheet.frameWidth / sheet.pixelsPerUnit;
  const baseHeight = sheet.frameHeight / sheet.pixelsPerUnit;
  items.forEach((item, i) => {
    const scale = item.scale ?? 1;
    const halfWidth = (baseWidth * scale) / 2;
    const height = baseHeight * scale;
    const column = item.column ?? 0;
    const row = item.row ?? 0;
    let u0 = column / sheet.columns;
    let u1 = (column + 1) / sheet.columns;
    if (item.flip) [u0, u1] = [u1, u0];
    const v0 = 1 - (row + 1) / sheet.rows;
    const v1 = 1 - row / sheet.rows;
    // углы: левый нижний, правый нижний, правый верхний, левый верхний
    const quad = [
      [-halfWidth, 0, u0, v0],
      [halfWidth, 0, u1, v0],
      [halfWidth, height, u1, v1],
      [-halfWidth, height, u0, v1],
    ];
    quad.forEach(([cx, cy, u, v], k) => {
      const vertex = i * 4 + k;
      positions.set([item.x, item.y ?? 0, item.z], vertex * 3);
      corners.set([cx, cy], vertex * 2);
      uvs.set([u, v], vertex * 2);
    });
    indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('corner', new THREE.BufferAttribute(corners, 2));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]);
  uniforms.map.value = sheet.texture;
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, fog: true });
  const mesh = new THREE.Mesh(geometry, material);
  // углы выходят за точки привязки — проще не отсекать пачку по рамке камеры
  mesh.frustumCulled = false;
  return mesh;
}
