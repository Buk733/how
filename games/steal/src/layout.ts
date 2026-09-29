// Карта мира: где двор, поляна, огород, пруд и пасхалки. Числа — единицы мира (≈ метры).
// Бани стоят в центре (world.ts), всё остальное — вокруг них.
import { distanceToPolyline, type Box, type Circle, type PointXZ } from '@engine/math';
import { CARPET, NEIGHBORS } from './config';

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
export const SOUTH = { fenceZ: 12.4, roadZ: 15, roadWidth: 2.6, forestFromZ: 21 } as const;

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

/** Остановка у дороги (чуть в стороне — машины проезжают мимо). */
export const BUS_STOP: PointXZ = { x: -21, z: 13.2 };

/**
 * Мемные порталы на концах дорожки: круглая каменная площадка, на которой кончается дорожка,
 * за ней — ворота лицом к камере, в воротах воронка. postX — насколько столбы ворот в стороне от середины.
 */
export const PORTAL = { padRadius: 2, gateZ: CARPET.z - 1.45, postX: 1.1, swirlRadius: 0.82, swirlY: 1.3 } as const;
/** Где порталы: из западного персонажи выходят, в восточный уходят. */
export const PORTAL_XS = [CARPET.startX - 1, CARPET.endX + 1] as const;
/** Шаг из воронки до середины дорожки. */
const STEP_OUT = CARPET.z - (PORTAL.gateZ + 0.2);
/** Весь путь персонажа по дорожке: из ворот, по дорожке, в другие ворота. */
export const WALK_LENGTH = STEP_OUT * 2 + (PORTAL_XS[1] - PORTAL_XS[0]);

/** Где персонаж, прошедший along от западной воронки. */
export function walkPoint(along: number): PointXZ {
  const [west, east] = PORTAL_XS;
  if (along < STEP_OUT) return { x: west, z: CARPET.z - STEP_OUT + along };
  const carpet = along - STEP_OUT;
  if (carpet <= east - west) return { x: west + carpet, z: CARPET.z };
  return { x: east, z: CARPET.z - Math.min(STEP_OUT, carpet - (east - west)) };
}

/** Сколько пройдено до точки x на дорожке. */
export function walkAlong(x: number): number {
  return STEP_OUT + (x - PORTAL_XS[0]);
}

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

/** Тропинка: ломаная (при рисовании сглаживается), ширина и на скольких единицах от начала и конца сходит на нет. */
export interface Trail {
  readonly points: readonly PointXZ[];
  readonly width: number;
  readonly taper?: readonly [number, number];
}

/** Где стоят бани (у входа — вытоптанная трава и тропинка к дорожке). */
export const BANYA_XS: readonly number[] = [0, ...NEIGHBORS.map((n) => n.x)];

/**
 * Тропинки. Концы, которые упираются в дорожку или пол бани, спрятаны под ними,
 * остальные скругляются или сходят на нет в траве.
 */
export const TRAILS: readonly Trail[] = [
  // от входа каждой бани к дорожке
  ...BANYA_XS.map((cx) => ({ points: [{ x: cx, z: 0.4 }, { x: cx, z: 5 }], width: 3 })),
  // в лес: из-под дорожки через проход между банями, мимо камня на поляну и к избушке
  {
    points: [
      { x: -12, z: 5 },
      { x: -11.6, z: 2.4 },
      { x: -11.8, z: -1.5 },
      { x: -12.2, z: -5 },
      { x: -11.9, z: -8.6 },
      { x: -12.3, z: -11.8 },
      { x: -11.8, z: -14.3 },
      { x: -12.4, z: -16.6 },
      { x: -14, z: -19.2 },
      { x: -15.6, z: -21 },
      { x: -16.7, z: -22.3 },
    ],
    width: 2,
    taper: [0, 0.8],
  },
  // с поляны к костру с медведем и к камню на распутье
  { points: [{ x: -12.3, z: -16.4 }, { x: -10.6, z: -18.4 }, { x: -8.6, z: -19.7 }, { x: -7, z: -20.2 }], width: 1.5 },
  { points: [{ x: -12, z: -15.4 }, { x: -10.9, z: -15.9 }, { x: -9.9, z: -16.3 }], width: 1.2 },
  // огород: к колодцу, между грядками и к домику
  { points: [{ x: GARDEN_PATH_X, z: 5 }, { x: -41.6, z: 2 }, { x: -42.2, z: -0.8 }, { x: -43, z: -3 }, { x: -43.3, z: -4.9 }], width: 1.8 },
  { points: [{ x: -44.4, z: -4.05 }, { x: -49, z: -4.1 }, { x: -53.4, z: -4.05 }], width: 0.9, taper: [0, 1.4] },
  { points: [{ x: -44.4, z: -6.25 }, { x: -49, z: -6.2 }, { x: -53.4, z: -6.25 }], width: 0.9, taper: [0, 1.4] },
  { points: [{ x: -44.2, z: -7.3 }, { x: -47, z: -8.35 }, { x: -50.4, z: -8.5 }, { x: -51.4, z: -8.3 }], width: 1, taper: [0, 0.6] },
  // к мосткам пруда
  { points: [{ x: PIER_PATH_X, z: 5 }, { x: 41.5, z: 2 }, { x: 41.9, z: -0.6 }, { x: 42.6, z: -2.4 }, { x: 43.4, z: -3.4 }, { x: 44.4, z: -3.6 }], width: 1.7 },
];

/** Старая машина стоит чуть наискось — передом к камере, чтобы были видны фары. */
export const CAR_HEADING = -0.2;
/** Точка у машины: along — вперёд от её центра, across — к ближнему боку. */
export function carPoint(along: number, across: number): PointXZ {
  const [c, s] = [Math.cos(CAR_HEADING), Math.sin(CAR_HEADING)];
  return { x: SPOTS.car.x + along * c + across * s, z: SPOTS.car.z - along * s + across * c };
}

/** Колея за старой машиной: она приехала с запада, свернула к кустам и заглохла. */
export const CAR_TRACKS: readonly Trail[] = [-0.72, 0.72].map((side) => {
  const bend = carPoint(-3.4, side);
  return {
    points: [carPoint(-1.2, side), bend, { x: bend.x - 2.4, z: bend.z - 0.3 }, { x: bend.x - 5, z: bend.z - 0.4 }],
    width: 0.3,
    taper: [0, 2.6],
  };
});

/** Утоптанные площадки: у колодца, вокруг костра, у ножек избушки. */
export const DIRT_PATCHES: readonly { readonly x: number; readonly z: number; readonly rx: number; readonly rz: number }[] = [
  { x: SPOTS.well.x, z: SPOTS.well.z + 0.4, rx: 1.7, rz: 1.3 },
  { x: (SPOTS.bear.x + SPOTS.campfire.x) / 2, z: SPOTS.campfire.z + 0.3, rx: 2.3, rz: 1.4 },
  { x: SPOTS.hut.x + 0.2, z: SPOTS.hut.z + 1, rx: 1.6, rz: 0.8 },
];

/** Где рисуются следы на земле: весь двор с поляной и отдельно полоса дороги на юге. */
export const MARKS_REGION: Box = { minX: -56, maxX: 56, minZ: WALK_BOUNDS.minZ - 1, maxZ: WALK_BOUNDS.maxZ + 1 };
export const ROAD_REGION: Box = { minX: GROUND.minX, maxX: GROUND.maxX, minZ: SOUTH.roadZ - 2.6, maxZ: SOUTH.roadZ + 2.6 };

/** Середина просёлочной дороги на юге: она чуть виляет. */
export function roadZ(x: number): number {
  return SOUTH.roadZ + Math.sin(x * 0.09) * 0.35;
}
export const ROAD: Trail = {
  points: Array.from({ length: 25 }, (_, i) => {
    const x = GROUND.minX - 2 + (i * (GROUND.maxX - GROUND.minX + 4)) / 24;
    return { x, z: roadZ(x) };
  }),
  width: SOUTH.roadWidth,
};

/** Твёрдые пасхалки и декор: в них упираются игрок и боты. */
export const LANDMARK_BOXES: readonly Box[] = [
  { minX: SPOTS.hut.x - 1.1, maxX: SPOTS.hut.x + 1.1, minZ: SPOTS.hut.z - 0.5, maxZ: SPOTS.hut.z + 0.3 },
  { minX: SPOTS.toilet.x - 0.55, maxX: SPOTS.toilet.x + 0.55, minZ: SPOTS.toilet.z - 0.45, maxZ: SPOTS.toilet.z + 0.3 },
];
export const LANDMARK_CIRCLES: readonly Circle[] = [
  { ...SPOTS.stone, radius: 0.85 },
  { ...SPOTS.bear, radius: 0.55 },
  { ...SPOTS.campfire, radius: 0.45 },
  { ...SPOTS.well, radius: 0.8 },
  { ...SPOTS.fisher, radius: 0.3 },
  { ...SCARECROW, radius: 0.3 },
  // машина стоит наискось — вдоль неё три круга
  ...[-1.35, 0, 1.35].map((along) => ({ ...carPoint(along, 0), radius: 0.85 })),
];

/** Лежит ли точка на открытом месте (margin > 0 — с запасом от края). */
export function isOpen(p: PointXZ, margin = 0): boolean {
  // края включительно: точка на стыке двора и тропинки — открытое место
  return OPEN_AREAS.some((b) => p.x >= b.minX - margin && p.x <= b.maxX + margin && p.z >= b.minZ - margin && p.z <= b.maxZ + margin);
}

/** Лежит ли точка на тропинке (margin > 0 — с запасом от края). */
export function onTrail(p: PointXZ, margin = 0): boolean {
  return TRAILS.some((trail) => distanceToPolyline(p, trail.points) < trail.width / 2 + margin);
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
