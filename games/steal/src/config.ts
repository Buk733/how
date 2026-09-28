// Основные «ручки» игры в одном месте: меняйте числа и смотрите, что получится.

/** Сколько пикселей текстур мира помещается в 1 единицу (≈ 1 метр). */
export const PIXELS_PER_UNIT = 16;

/**
 * Короткая сторона кадра в «игровых» пикселях: картинка рендерится в низком разрешении
 * и растягивается без сглаживания — получается ровный пиксельный стиль. 0 — полное разрешение.
 */
export const RENDER_SHORT_SIDE = 480;

export const SKY_COLOR = '#9fd8f5';
export const FOG = { near: 34, far: 80 } as const;

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

/** Размер мира: где можно ходить, дальше — лес. */
export const WORLD = {
  groundSize: { x: 140, z: 80 },
  bounds: { minX: -40, maxX: 40, minZ: -9.2, maxZ: 11 },
} as const;

export const PLAYER = {
  /** Скорость бега, единиц в секунду. */
  speed: 6.5,
  /** С персонажем на руках бежишь медленнее. */
  carrySpeedFactor: 0.72,
  radius: 0.35,
  /** Сколько секунд игрок «в нокауте», если сосед его поймал. */
  stunTime: 1.1,
  start: { x: 0, z: 2.6 },
} as const;

/** Мемная дорожка: по ней идут персонажи на продажу. */
export const CARPET = {
  z: 5.6,
  startX: -44,
  endX: 44,
  width: 2.6,
  walkSpeed: 2.1,
  /** Пауза между появлениями персонажей, секунды (случайно в этом промежутке). */
  spawnInterval: [2.0, 3.2] as const,
  maxWalkers: 22,
} as const;

/** С какого расстояния можно купить персонажа на дорожке. */
export const BUY_RANGE = 2.2;
/** С какого расстояния можно украсть персонажа с полка соседа. */
export const STEAL_RANGE = 1.6;
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

/** Соседи-боты: где их бани, как их зовут и каким спрайтом рисовать. */
export const NEIGHBORS = [
  { x: -24, name: 'Жорик', genitive: 'Жорика', sprite: 'neighborGreen' },
  { x: 24, name: 'Тимур', genitive: 'Тимура', sprite: 'neighborPurple' },
] as const;

export const BOT = {
  /** Сколько персонажей держит сосед на полке. */
  slots: 6,
  /** Скорость прогулки по своей бане, погони и бегства с добычей. */
  wanderSpeed: 1.6,
  chaseSpeed: 5.0,
  walkSpeed: 3.4,
  escapeSpeed: 3.0,
  /** Сколько сосед «соображает», прежде чем погнаться. */
  alertTime: 0.8,
  /** Дольше этого погоня не длится — сосед сдаётся. */
  chaseTimeout: 14,
  catchRadius: 0.9,
  /** Сосед спит [от, до] секунд, а не спит — [от, до] секунд. */
  sleepTime: [12, 20] as const,
  awakeTime: [22, 40] as const,
  /** Как часто сосед покупает себе нового персонажа, секунды. */
  refillInterval: [30, 60] as const,
} as const;

/** Набеги соседей на баню игрока. */
export const RAID = {
  /** Первый набег — не раньше, чем через столько секунд игры. */
  firstDelay: 150,
  /** Дальше — раз в [от, до] секунд. */
  interval: [70, 120] as const,
  /** Набеги начинаются, когда у игрока столько персонажей на полке. */
  minResidents: 3,
  /** Сколько сосед ждёт у закрытой бани, прежде чем уйти. */
  waitAtLock: 8,
} as const;

/** Щеколда: закрывает баню от воров. */
export const LOCK = { duration: 60 } as const;

export const AUDIO = {
  /** Все записи выравниваются по громкости к этому уровню. */
  normalizeTo: 0.1,
  /** Громкость мемных фраз персонажей и фоновой музыки. */
  voice: 0.55,
  music: 0.3,
  /** Музыка включается, когда на дорожке появляется персонаж такой редкости или выше. */
  musicFromRarity: 'legendary',
} as const;

/** Ключ сохранения в localStorage (локальный режим и запасная копия). */
export const SAVE_KEY = 'how.steal.save';
