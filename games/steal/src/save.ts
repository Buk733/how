import { BOT, ECONOMY, NEIGHBORS } from './config';
import { CASES } from './data/cases';
import { DEFAULT_HERO, isHeroId, type HeroId } from './data/heroes';
import { SECRET_IDS } from './data/secrets';
import { createUpgradeLevels, maxLevel, UPGRADE_IDS, type UpgradeLevels } from './upgrades';

/** Персонаж и его вариант: «Голда» — золотая версия с двойным доходом. */
export interface UnitSave {
  id: string;
  gold: boolean;
}

export interface SlotSave {
  /** id персонажа на месте или null, если место пустое. */
  id: string | null;
  gold: boolean;
  /** Накопленные и ещё не собранные монеты. */
  stored: number;
}

/** Полок соседа-бота: персонажи по местам. */
export interface NeighborSave {
  slots: (UnitSave | null)[];
}

/** Всё, что сохраняется между сессиями. При изменении формата — поднять version и дописать миграцию. */
export interface SaveData {
  version: 6;
  /** Кем игрок бегает по миру. */
  hero: HeroId;
  coins: number;
  /** Сколько мест на полке открыто. */
  unlocked: number;
  slots: SlotSave[];
  /** Полки соседей. Пустой список — соседей ещё не заселяли. */
  neighbors: NeighborSave[];
  /** Уровни прокачки. */
  upgrades: UpgradeLevels;
  /** Ключи от кейсов (выигрыш колеса удачи): id кейса → сколько. */
  keys: Record<string, number>;
  /** Когда (Date.now, мс) снова можно бесплатно открыть кейс и крутить колесо. */
  freeCaseAt: number;
  freeSpinAt: number;
  /** Спины колеса за рекламу: за какой день (ГГГГ-ММ-ДД) и сколько. */
  adSpins: { day: string; count: number };
  /** ×2 к доходу до этого момента (Date.now, мс). */
  boostUntil: number;
  /** Найденные пасхалки (id из data/secrets.ts). */
  secrets: string[];
  /**
   * Шаг обучения: 0 — купить персонажа, 1 — собрать монеты,
   * 2 — украсть у соседа, 3 — пройдено.
   */
  tutorial: number;
  /** Весь звук выключен. */
  muted: boolean;
  /** Музыка включена (звуки при этом остаются). */
  music: boolean;
  /** peakIncome — лучший доход без печи и ускорителя: по нему растут соседи. */
  stats: { bought: number; earned: number; stolen: number; lost: number; opened: number; upgraded: number; peakIncome: number };
  savedAt: number;
}

export const TUTORIAL_DONE = 3;

export function emptySlot(): SlotSave {
  return { id: null, gold: false, stored: 0 };
}

export function createSave(): SaveData {
  return {
    version: 6,
    hero: DEFAULT_HERO,
    coins: ECONOMY.startCoins,
    unlocked: ECONOMY.freeSlots,
    slots: Array.from({ length: ECONOMY.totalSlots }, emptySlot),
    neighbors: [],
    upgrades: createUpgradeLevels(),
    keys: {},
    freeCaseAt: 0,
    freeSpinAt: 0,
    adSpins: { day: '', count: 0 },
    boostUntil: 0,
    secrets: [],
    tutorial: 0,
    muted: false,
    music: true,
    stats: { bought: 0, earned: 0, stolen: 0, lost: 0, opened: 0, upgraded: 0, peakIncome: 0 },
    savedAt: 0,
  };
}

const nonNegative = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/** Персонаж соседа: в версиях 1–3 — просто id, с версии 4 — { id, gold }. */
function parseUnit(value: unknown, knownIds: ReadonlySet<string>): UnitSave | null {
  if (typeof value === 'string') return knownIds.has(value) ? { id: value, gold: false } : null;
  const unit = record(value);
  if (!unit || typeof unit.id !== 'string' || !knownIds.has(unit.id)) return null;
  return { id: unit.id, gold: unit.gold === true };
}

/**
 * Проверяет сохранение, пришедшее из хранилища. Всё сломанное или незнакомое
 * заменяется значениями по умолчанию, неизвестные персонажи убираются.
 * Понимает сохранения версий 1 (до соседей), 2 (до прокачки), 3 (до «Голды» и кейсов),
 * 4 (до пасхалок и прокачки соседей), 5 (до выбора героя) и 6.
 */
export function parseSave(raw: unknown, knownIds: ReadonlySet<string>): SaveData {
  const save = createSave();
  const data = record(raw);
  if (!data || ![1, 2, 3, 4, 5, 6].includes(data.version as number)) return save;

  if (isHeroId(data.hero)) save.hero = data.hero;
  save.coins = nonNegative(data.coins, save.coins);
  save.unlocked = Math.min(ECONOMY.totalSlots, Math.max(ECONOMY.freeSlots, Math.floor(nonNegative(data.unlocked, 0))));
  save.tutorial = Math.min(TUTORIAL_DONE, Math.floor(nonNegative(data.tutorial, 0)));
  save.muted = data.muted === true;
  save.music = data.music !== false;
  save.savedAt = nonNegative(data.savedAt, 0);
  const stats = record(data.stats);
  if (stats) {
    for (const key of Object.keys(save.stats) as (keyof SaveData['stats'])[]) save.stats[key] = nonNegative(stats[key], 0);
  }
  if (Array.isArray(data.slots)) {
    data.slots.slice(0, ECONOMY.totalSlots).forEach((slot: unknown, i) => {
      const s = record(slot);
      if (!s || i >= save.unlocked) return;
      if (typeof s.id === 'string' && knownIds.has(s.id)) save.slots[i] = { id: s.id, gold: s.gold === true, stored: nonNegative(s.stored, 0) };
    });
  }
  if (Array.isArray(data.neighbors) && data.neighbors.length === NEIGHBORS.length) {
    save.neighbors = data.neighbors.map((neighbor: unknown) => {
      const slots = record(neighbor)?.slots;
      return { slots: Array.from({ length: BOT.slots }, (_, i) => parseUnit(Array.isArray(slots) ? slots[i] : null, knownIds)) };
    });
  }
  const upgrades = record(data.upgrades);
  if (upgrades) {
    for (const id of UPGRADE_IDS) save.upgrades[id] = Math.min(maxLevel(id), Math.floor(nonNegative(upgrades[id], 0)));
  }
  const keys = record(data.keys);
  if (keys) {
    for (const { id } of CASES) {
      const count = Math.floor(nonNegative(keys[id], 0));
      if (count > 0) save.keys[id] = count;
    }
  }
  save.freeCaseAt = nonNegative(data.freeCaseAt, 0);
  save.freeSpinAt = nonNegative(data.freeSpinAt, 0);
  save.boostUntil = nonNegative(data.boostUntil, 0);
  const adSpins = record(data.adSpins);
  if (adSpins && typeof adSpins.day === 'string') save.adSpins = { day: adSpins.day, count: Math.floor(nonNegative(adSpins.count, 0)) };
  if (Array.isArray(data.secrets)) {
    save.secrets = [...new Set(data.secrets.filter((id): id is string => typeof id === 'string' && SECRET_IDS.has(id)))];
  }
  return save;
}
