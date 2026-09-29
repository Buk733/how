// Объёмные модели из коробок с пиксельными картинками на гранях: машины, ворота, постаменты.
// Грани с одним материалом собираются в одну группу — модель рисуется за несколько вызовов,
// а не по вызову на каждую грань. Свет «запечён» в цвет вершин: верх как нарисован, бока темнее —
// рисовать такие модели материалом без освещения (vertexColors), и картинки не пересвечиваются.
import * as THREE from 'three';

export type Vec3 = readonly [number, number, number];

/** Грань: номер материала и клетка его листа [столбец, строка] (по умолчанию [0, 0]). */
export type BoxFace = readonly [material: number, column?: number, row?: number];

/**
 * Грани коробки. Модель смотрит вперёд по +x, камера — с ближнего бока (+z) и сверху.
 * Низа нет: его никогда не видно. Не указанная грань не рисуется.
 */
export interface BoxFaces {
  /** Перед (+x): слева на картинке — ближний бок. */
  readonly front?: BoxFace;
  /** Зад (−x): слева на картинке — дальний бок. */
  readonly back?: BoxFace;
  /** Верх: слева зад, справа перед, верхние строки картинки — дальний бок. */
  readonly top?: BoxFace;
  /** Ближний бок (+z): слева зад, справа перед. */
  readonly near?: BoxFace;
  /** Дальний бок (−z): та же картинка зеркально — зад остаётся сзади. */
  readonly far?: BoxFace;
}

/** Необязательная форма коробки. */
export interface BoxShape {
  /** Насколько верх уже низа сзади и спереди: наклонные грани (лобовое стекло) видно сверху. */
  readonly slant?: readonly [back: number, front: number];
}

interface Quad {
  readonly material: number;
  readonly corners: readonly Vec3[];
  readonly normal: Vec3;
  readonly uv: readonly number[];
}

/** Яркость грани по её направлению: верх — 1, ближний бок чуть темнее, торцы и дальний бок — ещё темнее. */
export function faceShade([x, y, z]: Vec3): number {
  return Math.min(1, 0.74 + 0.26 * Math.max(0, y) + 0.12 * z - 0.02 * Math.abs(x));
}

/** Собирает модель из коробок в одну геометрию с группами по материалам. */
export class BoxModel {
  private readonly quads: Quad[] = [];
  private readonly grids: readonly (readonly [number, number])[];

  /** grids[i] — на сколько клеток [столбцов, строк] поделена картинка материала i (нет — одна клетка). */
  constructor(grids: readonly (readonly [number, number])[] = []) {
    this.grids = grids;
  }

  /** Коробка размером size с центром в at. */
  box(size: Vec3, at: Vec3, faces: BoxFaces, shape: BoxShape = {}): this {
    const [sx, sy, sz] = size;
    const [cx, cy, cz] = at;
    const [x0, x1, y0, y1, z0, z1] = [cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, cz - sz / 2, cz + sz / 2];
    // верхние рёбра спереди и сзади могут быть сдвинуты внутрь
    const [back, front] = shape.slant ?? [0, 0];
    const [t0, t1] = [x0 + back, x1 - front];
    // углы по порядку: левый нижний, правый нижний, правый верхний, левый верхний — если смотреть на грань снаружи
    if (faces.near) this.quad(faces.near, [[x0, y0, z1], [x1, y0, z1], [t1, y1, z1], [t0, y1, z1]]);
    if (faces.far) this.quad(faces.far, [[x1, y0, z0], [x0, y0, z0], [t0, y1, z0], [t1, y1, z0]], true);
    if (faces.front) this.quad(faces.front, [[x1, y0, z1], [x1, y0, z0], [t1, y1, z0], [t1, y1, z1]]);
    if (faces.back) this.quad(faces.back, [[x0, y0, z0], [x0, y0, z1], [t0, y1, z1], [t0, y1, z0]]);
    if (faces.top) this.quad(faces.top, [[t0, y1, z1], [t1, y1, z1], [t1, y1, z0], [t0, y1, z0]]);
    return this;
  }

  /** Геометрия: грани отсортированы по материалу, одна группа на материал. */
  build(): THREE.BufferGeometry {
    const quads = [...this.quads].sort((a, b) => a.material - b.material);
    const positions: number[] = [];
    const normals: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const geometry = new THREE.BufferGeometry();
    quads.forEach((quad, k) => {
      for (const corner of quad.corners) positions.push(...corner);
      const shade = faceShade(quad.normal);
      for (let i = 0; i < 4; i++) {
        normals.push(...quad.normal);
        colors.push(shade, shade, shade);
      }
      uvs.push(...quad.uv);
      const base = k * 4;
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      const last = geometry.groups[geometry.groups.length - 1];
      if (last && last.materialIndex === quad.material) last.count += 6;
      else geometry.addGroup(k * 6, 6, quad.material);
    });
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }

  private quad(face: BoxFace, corners: readonly Vec3[], mirror = false): void {
    // нормаль — по трём углам: у наклонных граней она смотрит вверх-вперёд
    const [a, b, , d] = corners;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(n[0], n[1], n[2]) || 1;
    const normal: Vec3 = [n[0] / length, n[1] / length, n[2] / length];
    const [material, column = 0, row = 0] = face;
    const [columns, rows] = this.grids[material] ?? [1, 1];
    let u0 = column / columns;
    let u1 = (column + 1) / columns;
    // строка 0 — верх картинки (текстуры загружаются с переворотом по v)
    const v0 = 1 - (row + 1) / rows;
    const v1 = 1 - row / rows;
    if (mirror) [u0, u1] = [u1, u0];
    this.quads.push({ material, corners, normal, uv: [u0, v0, u1, v0, u1, v1, u0, v1] });
  }
}
