// Небольшие математические помощники без Three.js — их легко тестировать.

/** Точка на земле (плоскость XZ). */
export interface PointXZ {
  readonly x: number;
  readonly z: number;
}

/** Круглое препятствие на земле. */
export interface Circle extends PointXZ {
  readonly radius: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Плавно приближает current к target. Не зависит от FPS: результат одинаковый
 * при 30 и 144 кадрах в секунду. Чем больше sharpness, тем быстрее.
 */
export function damp(current: number, target: number, sharpness: number, dt: number): number {
  return target + (current - target) * Math.exp(-sharpness * dt);
}

export function distanceXZ(a: PointXZ, b: PointXZ): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Выталкивает круг с центром (x, z) из всех препятствий, которые он задевает. */
export function pushOutOfCircles(x: number, z: number, radius: number, obstacles: readonly Circle[]): PointXZ {
  let px = x;
  let pz = z;
  for (const obstacle of obstacles) {
    const dx = px - obstacle.x;
    const dz = pz - obstacle.z;
    const minDistance = radius + obstacle.radius;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= minDistance * minDistance) continue;
    const distance = Math.sqrt(distanceSq);
    if (distance < 1e-6) {
      // Ровно в центре препятствия — выталкиваем в любую сторону.
      px = obstacle.x + minDistance;
      continue;
    }
    const push = (minDistance - distance) / distance;
    px += dx * push;
    pz += dz * push;
  }
  return { x: px, z: pz };
}

/** Не даёт точке выйти за круг радиуса limit с центром в начале координат. */
export function clampToRadius(x: number, z: number, limit: number): PointXZ {
  const distance = Math.hypot(x, z);
  if (distance <= limit) return { x, z };
  const k = limit / distance;
  return { x: x * k, z: z * k };
}

/** Прямоугольное препятствие на земле (стена, скамья, печь). */
export interface Box {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
}

/** Выталкивает круг с центром (x, z) из прямоугольников, которые он задевает. */
export function pushOutOfBoxes(x: number, z: number, radius: number, boxes: readonly Box[]): PointXZ {
  let px = x;
  let pz = z;
  for (const box of boxes) {
    const cx = clamp(px, box.minX, box.maxX);
    const cz = clamp(pz, box.minZ, box.maxZ);
    const dx = px - cx;
    const dz = pz - cz;
    const distanceSq = dx * dx + dz * dz;
    if (distanceSq >= radius * radius) continue;
    if (distanceSq > 1e-12) {
      const distance = Math.sqrt(distanceSq);
      const push = (radius - distance) / distance;
      px += dx * push;
      pz += dz * push;
      continue;
    }
    // Центр внутри прямоугольника — выталкиваем к ближайшей стороне.
    const exits = [
      { d: px - box.minX, x: box.minX - radius, z: pz },
      { d: box.maxX - px, x: box.maxX + radius, z: pz },
      { d: pz - box.minZ, x: px, z: box.minZ - radius },
      { d: box.maxZ - pz, x: px, z: box.maxZ + radius },
    ];
    const nearest = exits.reduce((best, exit) => (exit.d < best.d ? exit : best));
    px = nearest.x;
    pz = nearest.z;
  }
  return { x: px, z: pz };
}

/** Не даёт точке выйти за прямоугольник. */
export function clampToBox(x: number, z: number, box: Box): PointXZ {
  return { x: clamp(x, box.minX, box.maxX), z: clamp(z, box.minZ, box.maxZ) };
}
