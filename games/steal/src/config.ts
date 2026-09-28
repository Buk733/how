// Основные «ручки» игры в одном месте: меняйте числа и смотрите, что получится.

/** Сколько пикселей текстур мира помещается в 1 единицу (≈ 1 метр). */
export const PIXELS_PER_UNIT = 16;

/**
 * Короткая сторона кадра в «игровых» пикселях: картинка рендерится в низком разрешении
 * и растягивается без сглаживания — получается ровный пиксельный стиль. 0 — полное разрешение.
 */
export const RENDER_SHORT_SIDE = 480;

export const SKY_COLOR = '#9fd8f5';
export const FOG = { near: 30, far: 70 } as const;

export const CAMERA = {
  fov: 42,
  pitchDeg: 56,
  distance: 21,
  minDistance: 12,
  maxDistance: 30,
  /** На вертикальном экране камера шире и дальше, иначе по бокам ничего не видно. */
  portraitFov: 58,
  portraitDistanceScale: 1.35,
  yawStepDeg: 45,
  followSharpness: 6,
  rotateSharpness: 10,
  zoomSharpness: 10,
  lookHeight: 0.8,
  lead: 2,
} as const;

export const PLAYER = {
  /** Скорость бега, единиц в секунду. */
  speed: 6.5,
  radius: 0.35,
  start: { x: 0, z: 2.6 },
} as const;

/** Мемная дорожка: по ней идут персонажи на продажу. */
export const CARPET = {
  z: 5.6,
  startX: -26,
  endX: 26,
  width: 2.6,
  walkSpeed: 1.8,
  /** Пауза между появлениями персонажей, секунды (случайно в этом промежутке). */
  spawnInterval: [2.2, 3.6] as const,
  maxWalkers: 14,
} as const;

/** С какого расстояния можно купить персонажа на дорожке. */
export const BUY_RANGE = 2.2;
/** Радиус плиты сбора монет. */
export const PLATE_RADIUS = 0.75;

export const ECONOMY = {
  startCoins: 50,
  /** Мест на полке всего и сколько открыто сразу. */
  totalSlots: 8,
  freeSlots: 4,
  /** Цена открытия следующих мест по порядку. */
  unlockCosts: [150, 600, 2500, 10000] as const,
  /** Какую долю цены возвращают за персонажа, которого заменили. */
  sellRatio: 0.5,
} as const;

/** Ключ сохранения в localStorage (локальный режим и запасная копия). */
export const SAVE_KEY = 'how.steal.save';
