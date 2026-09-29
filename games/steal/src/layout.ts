// Карта мира: где двор, поляна, огород, пруд и пасхалки. Числа — единицы мира (≈ метры).
// Бани стоят в центре (world.ts), всё остальное — вокруг них.
import type { Box, Circle, PointXZ } from '@engine/math';

/** Земля целиком. Дальше — туман и небо. */
export const GROUND: Box = { minX: -86, maxX: 86, minZ: -60, maxZ: 36 };

/** Где вообще можно ходить. Всё внутри, что не открыто (OPEN_AREAS), — чаща. */
export const WALK_BOUNDS: Box = { minX: -54, maxX: 54, minZ: -26, maxZ: 11 };

/** Двор: бани, дорожка, огород на западе и пруд на востоке. */
export const YARD: Box = { minX: -54, maxX: 54, minZ: -9.2, maxZ: 11 };
/** Тропинка в лес — из прохода между баней игрока и баней Жорика. */
export const TRAIL: Box = { minX: -13.3, maxX: -10.7, minZ: -15.5, maxZ: YARD.minZ };
/** Лесная поляна с избушкой, медведем и камнем на распутье. */
export const GLADE: Box = { minX: -24, maxX: -1, minZ: WALK_BOUNDS.minZ, maxZ: TRAIL.minZ };

export const OPEN_AREAS: readonly Box[] = [YARD, TRAIL, GLADE];

/** Чаща внутри WALK_BOUNDS: невидимые стены, которые не пускают в лес. */
export const FOREST_WALLS: readonly Box[] = [
  { minX: WALK_BOUNDS.minX, maxX: TRAIL.minX, minZ: TRAIL.minZ, maxZ: YARD.minZ },
  { minX: TRAIL.maxX, maxX: WALK_BOUNDS.maxX, minZ: TRAIL.minZ, maxZ: YARD.minZ },
  { minX: WALK_BOUNDS.minX, maxX: GLADE.minX, minZ: GLADE.minZ, maxZ: GLADE.maxZ },
  { minX: GLADE.maxX, maxX: WALK_BOUNDS.maxX, minZ: GLADE.minZ, maxZ: GLADE.maxZ },
];

/** Южный край: забор, луг и просёлочная дорога (туда не пройти). */
export const SOUTH = { fenceZ: 12.4, roadZ: 15.8, roadWidth: 2.6, forestFromZ: 21 } as const;

/** Пруд на востоке и мостки, с которых удит рыбак. */
export const POND = { x: 48.6, z: -3.6, rx: 4.6, rz: 3.3 } as const;
export const PIER: Box = { minX: 43.2, maxX: 46.9, minZ: -4.2, maxZ: -3.0 };
/** Тропинки от дорожки (мимо порталов): в огород и к мосткам. */
export const GARDEN_PATH_X = -41.4;
export const PIER_PATH_X = 41.4;

/** Огород на западе: грядки (прямоугольники), пугало. */
export const GARDEN_BEDS: readonly Box[] = [
  { minX: -53, maxX: -45.5, minZ: -7.8, maxZ: -6.9 },
  { minX: -53, maxX: -45.5, minZ: -5.6, maxZ: -4.7 },
  { minX: -53, maxX: -45.5, minZ: -3.4, maxZ: -2.5 },
];
export const SCARECROW: PointXZ = { x: -49.2, z: -0.9 };

/** Ветряная мельница на лесной опушке за огородом (туда не пройти — видна издалека). */
export const WINDMILL: PointXZ = { x: -46, z: -17.5 };
export const WINDMILL_CLEARING = 5;

/** Остановка у дороги. */
export const BUS_STOP: PointXZ = { x: -21, z: 14.2 };

/** Где стоят пасхалки (id — как в data/secrets.ts). */
export const SPOTS = {
  stone: { x: -9.2, z: -16.8 },
  hut: { x: -17, z: -23.6 },
  bear: { x: -7.4, z: -20.4 },
  campfire: { x: -5.7, z: -20.6 },
  well: { x: -43.2, z: -6.4 },
  toilet: { x: -52.3, z: -8.3 },
  fisher: { x: 46.3, z: -3.55 },
  car: { x: 50.6, z: 9.4 },
} as const satisfies Record<string, PointXZ>;

/** Твёрдые пасхалки и декор: в них упираются игрок и боты. */
export const LANDMARK_BOXES: readonly Box[] = [
  { minX: SPOTS.hut.x - 1.1, maxX: SPOTS.hut.x + 1.1, minZ: SPOTS.hut.z - 0.5, maxZ: SPOTS.hut.z + 0.3 },
  { minX: SPOTS.toilet.x - 0.55, maxX: SPOTS.toilet.x + 0.55, minZ: SPOTS.toilet.z - 0.45, maxZ: SPOTS.toilet.z + 0.3 },
  { minX: SPOTS.car.x - 1.25, maxX: SPOTS.car.x + 1.25, minZ: SPOTS.car.z - 0.45, maxZ: SPOTS.car.z + 0.25 },
];
export const LANDMARK_CIRCLES: readonly Circle[] = [
  { ...SPOTS.stone, radius: 0.85 },
  { ...SPOTS.bear, radius: 0.55 },
  { ...SPOTS.campfire, radius: 0.45 },
  { ...SPOTS.well, radius: 0.8 },
  { ...SPOTS.fisher, radius: 0.3 },
  { ...SCARECROW, radius: 0.3 },
];

/** Лежит ли точка на открытом месте (margin > 0 — с запасом от края). */
export function isOpen(p: PointXZ, margin = 0): boolean {
  // края включительно: точка на стыке двора и тропинки — открытое место
  return OPEN_AREAS.some((b) => p.x >= b.minX - margin && p.x <= b.maxX + margin && p.z >= b.minZ - margin && p.z <= b.maxZ + margin);
}

/** Внутри ли точка пруда (scale > 1 — вместе с берегом). */
export function inPond(p: PointXZ, scale = 1): boolean {
  return ((p.x - POND.x) / (POND.rx * scale)) ** 2 + ((p.z - POND.z) / (POND.rz * scale)) ** 2 <= 1;
}

/**
 * Вода пруда как набор кругов-препятствий: в воду не зайти, а по мосткам — можно.
 * Круги перекрываются, поэтому между ними не проскочить.
 */
export function pondColliders(): Circle[] {
  const radius = 0.85;
  const circles: Circle[] = [];
  const nearPier = (x: number, z: number) => {
    const dx = Math.max(PIER.minX - x, 0, x - PIER.maxX);
    const dz = Math.max(PIER.minZ - z, 0, z - PIER.maxZ);
    return Math.hypot(dx, dz) < radius;
  };
  for (let x = POND.x - POND.rx; x <= POND.x + POND.rx; x += 1.1)
    for (let z = POND.z - POND.rz; z <= POND.z + POND.rz; z += 1.1) {
      const inside = ((x - POND.x) / (POND.rx - 0.55)) ** 2 + ((z - POND.z) / (POND.rz - 0.55)) ** 2 <= 1;
      if (inside && !nearPier(x, z)) circles.push({ x, z, radius });
    }
  // вдоль мостков и у их конца — чтобы с мостков не сойти в воду
  for (let x = PIER.minX + 0.9; x <= PIER.maxX; x += 0.8) {
    for (const z of [PIER.minZ - radius, PIER.maxZ + radius]) if (inPond({ x, z })) circles.push({ x, z, radius });
  }
  circles.push({ x: PIER.maxX + radius, z: (PIER.minZ + PIER.maxZ) / 2, radius });
  return circles;
}
