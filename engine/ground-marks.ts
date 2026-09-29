// Следы на земле — тропинки, грядки, песок, вытоптанные пятачки — в одну пиксельную картинку.
// Пиксели считаются здесь, без Three.js, поэтому это легко тестировать.
import type { Box, PointXZ } from './math';

/** Как выглядит след. */
export interface MarkStyle {
  /** Основные цвета: пятнами по шуму. */
  readonly fill: readonly string[];
  /** Край шириной в пиксель (у вытоптанной травы края нет). */
  readonly rim?: string;
  /** Редкие вкрапления: камешки, комочки. */
  readonly specks?: readonly string[];
  /** Борозды вдоль x (грядка): цвета рядов пикселей по кругу. */
  readonly furrows?: readonly string[];
  /** Вытоптанная трава, колея: закрашена только эта доля пикселей — комочками, к краю реже. */
  readonly coverage?: number;
  /** На каком расстоянии от края доля доходит до coverage, единиц (по умолчанию 0.7). */
  readonly fade?: number;
}

/**
 * След: ломаная линия заданной ширины (тропинка), эллипс (пятно, песок) или прямоугольник
 * со скруглёнными углами (грядка). Линия сглаживается, концы у неё круглые;
 * taper — на скольких единицах от начала и от конца она сходит на нет.
 */
export type GroundMark =
  | { readonly style: MarkStyle; readonly line: readonly PointXZ[]; readonly width: number; readonly taper?: readonly [number, number] }
  | { readonly style: MarkStyle; readonly ellipse: PointXZ; readonly rx: number; readonly rz: number }
  | { readonly style: MarkStyle; readonly rect: Box; readonly radius?: number };

export interface MarkPixels {
  readonly width: number;
  readonly height: number;
  /** RGBA. Строка 0 — южный край области (наибольший z): так картинка ложится на плоскость без переворота. */
  readonly data: Uint8Array;
}

/** Насколько рваный край следа, единиц. */
const EDGE_JITTER = 0.11;
/** Доля пикселей-вкраплений. */
const SPECK_CHANCE = 0.035;

/** Детерминированный «случайный» 0…1 для целых координат. */
function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Плавный шум 0…1 с ячейкой cell единиц. */
function smoothNoise(x: number, z: number, cell: number, seed: number): number {
  const gx = x / cell;
  const gz = z / cell;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, seed);
  const b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed);
  const d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

/** Кривая Катмулла — Рома через точки: ломаная становится плавной, концы остаются на месте. */
export function smoothLine(points: readonly PointXZ[], samples = 6): PointXZ[] {
  if (points.length < 3) return [...points];
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))];
  const out: PointXZ[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let k = 0; k < samples; k++) {
      const t = k / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      const blend = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: blend(p0.x, p1.x, p2.x, p3.x), z: blend(p0.z, p1.z, p2.z, p3.z) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

const hexCache = new Map<string, readonly [number, number, number]>();
function rgb(hex: string): readonly [number, number, number] {
  let value = hexCache.get(hex);
  if (!value) {
    value = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    hexCache.set(hex, value);
  }
  return value;
}

/**
 * Рисует следы в картинку области region (pixelsPerUnit пикселей на единицу).
 * Следы идут по порядку: следующий рисуется поверх предыдущего. Идущие подряд следы
 * с одним и тем же объектом стиля сливаются в один — на развилках тропинок нет края.
 */
export function rasterizeMarks(marks: readonly GroundMark[], region: Box, pixelsPerUnit: number, seed = 1): MarkPixels {
  const width = Math.round((region.maxX - region.minX) * pixelsPerUnit);
  const height = Math.round((region.maxZ - region.minZ) * pixelsPerUnit);
  const owner = new Int16Array(width * height).fill(-1);
  const depth = new Float32Array(width * height);
  const field = new Float32Array(width * height).fill(Infinity);
  const px = (i: number) => region.minX + (i + 0.5) / pixelsPerUnit;
  const pz = (j: number) => region.maxZ - (j + 0.5) / pixelsPerUnit;
  const columns = (minX: number, maxX: number) => [
    Math.max(0, Math.floor((minX - region.minX) * pixelsPerUnit)),
    Math.min(width - 1, Math.ceil((maxX - region.minX) * pixelsPerUnit)),
  ];
  const rows = (minZ: number, maxZ: number) => [
    Math.max(0, Math.floor((region.maxZ - maxZ) * pixelsPerUnit)),
    Math.min(height - 1, Math.ceil((region.maxZ - minZ) * pixelsPerUnit)),
  ];

  // область, которую трогают следы, — чтобы потом записать их пиксели
  const touched: [number, number, number, number] = [width, 0, height, 0];
  /** Первый след в группе слившихся — по нему потом берётся стиль. */
  let first = 0;
  marks.forEach((mark, index) => {
    /** Считает поле расстояний на прямоугольнике [minX…maxX]×[minZ…maxZ], беря минимум. */
    const paint = (minX: number, maxX: number, minZ: number, maxZ: number, distance: (x: number, z: number) => number) => {
      const [i0, i1] = columns(minX, maxX);
      const [j0, j1] = rows(minZ, maxZ);
      touched[0] = Math.min(touched[0], i0);
      touched[1] = Math.max(touched[1], i1);
      touched[2] = Math.min(touched[2], j0);
      touched[3] = Math.max(touched[3], j1);
      for (let j = j0; j <= j1; j++) {
        const z = pz(j);
        for (let i = i0; i <= i1; i++) {
          const k = j * width + i;
          const d = distance(px(i), z);
          if (d < field[k]) field[k] = d;
        }
      }
    };

    if ('line' in mark) {
      const points = smoothLine(mark.line);
      const lengths = [0];
      for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
      const total = lengths[lengths.length - 1];
      const [taperStart, taperEnd] = mark.taper ?? [0, 0];
      const halfWidth = (s: number) => {
        let factor = 1;
        if (taperStart > 0 && s < taperStart) factor = Math.min(factor, 0.12 + 0.88 * (s / taperStart));
        if (taperEnd > 0 && total - s < taperEnd) factor = Math.min(factor, 0.12 + 0.88 * ((total - s) / taperEnd));
        // тропинка чуть «дышит» по ширине
        return (mark.width / 2) * factor * (0.9 + 0.2 * smoothNoise(s, 0, 2.5, seed + index));
      };
      const reach = mark.width / 2 + EDGE_JITTER * 2;
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const length2 = dx * dx + dz * dz || 1e-9;
        // ширина по концам отрезка — между ними плавно (отрезки короткие)
        const [wa, wb] = [halfWidth(lengths[i]), halfWidth(lengths[i + 1])];
        paint(Math.min(a.x, b.x) - reach, Math.max(a.x, b.x) + reach, Math.min(a.z, b.z) - reach, Math.max(a.z, b.z) + reach, (x, z) => {
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / length2));
          const ox = x - (a.x + dx * t);
          const oz = z - (a.z + dz * t);
          return Math.sqrt(ox * ox + oz * oz) - (wa + (wb - wa) * t);
        });
      }
    } else if ('ellipse' in mark) {
      const { ellipse: c, rx, rz } = mark;
      const reach = EDGE_JITTER * 2;
      paint(c.x - rx - reach, c.x + rx + reach, c.z - rz - reach, c.z + rz + reach, (x, z) => (Math.hypot((x - c.x) / rx, (z - c.z) / rz) - 1) * Math.min(rx, rz));
    } else {
      const box = mark.rect;
      const r = mark.radius ?? 0;
      const cx = (box.minX + box.maxX) / 2;
      const cz = (box.minZ + box.maxZ) / 2;
      const hx = (box.maxX - box.minX) / 2 - r;
      const hz = (box.maxZ - box.minZ) / 2 - r;
      const reach = EDGE_JITTER * 2;
      paint(box.minX - reach, box.maxX + reach, box.minZ - reach, box.maxZ + reach, (x, z) => {
        const qx = Math.abs(x - cx) - hx;
        const qz = Math.abs(z - cz) - hz;
        return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
      });
    }

    // следующий след того же стиля дорисуется в то же поле
    if (marks[index + 1]?.style === mark.style) return;
    // записать пиксели группы (с рваным краем) и сбросить поле расстояний
    const { coverage, fade = 0.7 } = mark.style;
    for (let j = touched[2]; j <= touched[3]; j++) {
      for (let i = touched[0]; i <= touched[1]; i++) {
        const k = j * width + i;
        const f = field[k];
        field[k] = Infinity;
        // дальше рваного края — точно не след, шум не нужен
        if (f >= EDGE_JITTER) continue;
        const d = f + (smoothNoise(px(i), pz(j), 0.45, seed) - 0.5) * 2 * EDGE_JITTER;
        if (d >= 0) continue;
        if (coverage !== undefined) {
          // комочки земли, а не ровная рябь
          const roll = smoothNoise(px(i), pz(j), 0.3, seed + 7) * 0.6 + hash(i, j, seed + 7) * 0.4;
          if (roll > coverage * Math.min(1, -d / fade)) continue;
        }
        owner[k] = first;
        depth[k] = -d;
      }
    }
    touched.splice(0, 4, width, 0, height, 0);
    first = index + 1;
  });

  // раскраска
  const data = new Uint8Array(width * height * 4);
  const rim = 1.25 / pixelsPerUnit;
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const k = j * width + i;
      const index = owner[k];
      if (index < 0) continue;
      const style = marks[index].style;
      let color: string;
      if (style.rim && depth[k] < rim) color = style.rim;
      else if (style.specks && hash(i, j, seed + 3) < SPECK_CHANCE) color = style.specks[Math.floor(hash(j, i, seed + 5) * style.specks.length)];
      else if (style.furrows) color = style.furrows[j % style.furrows.length];
      else {
        // пятна цвета плюс лёгкое смешивание соседних оттенков на границах пятен
        const patch = smoothNoise(px(i), pz(j), 0.9, seed + 11) * style.fill.length + (hash(i, j, seed + 13) - 0.5) * 0.6;
        color = style.fill[Math.max(0, Math.min(style.fill.length - 1, Math.floor(patch)))];
      }
      const [r, g, b] = rgb(color);
      data[k * 4] = r;
      data[k * 4 + 1] = g;
      data[k * 4 + 2] = b;
      data[k * 4 + 3] = 255;
    }
  }
  return { width, height, data };
}
