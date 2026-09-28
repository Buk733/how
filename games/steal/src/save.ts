import { BOT, ECONOMY, NEIGHBORS } from './config';
import { createUpgradeLevels, maxLevel, UPGRADE_IDS, type UpgradeLevels } from './upgrades';

export interface SlotSave {
  /** id персонажа на месте или null, если место пустое. */
  id: string | null;
  /** Накопленные и ещё не собранные монеты. */
  stored: number;
}

/** Полок соседа-бота: id персонажей по местам. */
export interface NeighborSave {
  slots: (string | null)[];
}

/** Всё, что сохраняется между сессиями. При изменении формата — поднять version и дописать миграцию. */
export interface SaveData {
  version: 3;
  coins: number;
  /** Сколько мест на полке открыто. */
  unlocked: number;
  slots: SlotSave[];
  /** Полки соседей. Пустой список — соседей ещё не заселяли. */
  neighbors: NeighborSave[];
  /** Уровни прокачки. */
  upgrades: UpgradeLevels;
  /**
   * Шаг обучения: 0 — купить персонажа, 1 — собрать монеты,
   * 2 — украсть у соседа, 3 — пройдено.
   */
  tutorial: number;
  /** Весь звук выключен. */
  muted: boolean;
  /** Музыка включена (звуки при этом остаются). */
  music: boolean;
  stats: { bought: number; earned: number; stolen: number; lost: number };
  savedAt: number;
}

export const TUTORIAL_DONE = 3;

export function createSave(): SaveData {
  return {
    version: 3,
    coins: ECONOMY.startCoins,
    unlocked: ECONOMY.freeSlots,
    slots: Array.from({ length: ECONOMY.totalSlots }, () => ({ id: null, stored: 0 })),
    neighbors: [],
    upgrades: createUpgradeLevels(),
    tutorial: 0,
    muted: false,
    music: true,
    stats: { bought: 0, earned: 0, stolen: 0, lost: 0 },
    savedAt: 0,
  };
}

const nonNegative = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

const record = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

/**
 * Проверяет сохранение, пришедшее из хранилища. Всё сломанное или незнакомое
 * заменяется значениями по умолчанию, неизвестные персонажи убираются.
 * Понимает сохранения версии 1 (до соседей), 2 (до прокачки) и 3.
 */
export function parseSave(raw: unknown, knownIds: ReadonlySet<string>): SaveData {
  const save = createSave();
  const data = record(raw);
  if (!data || (data.version !== 1 && data.version !== 2 && data.version !== 3)) return save;

  save.coins = nonNegative(data.coins, save.coins);
  save.unlocked = Math.min(ECONOMY.totalSlots, Math.max(ECONOMY.freeSlots, Math.floor(nonNegative(data.unlocked, 0))));
  save.tutorial = Math.min(TUTORIAL_DONE, Math.floor(nonNegative(data.tutorial, 0)));
  save.muted = data.muted === true;
  save.music = data.music !== false;
  save.savedAt = nonNegative(data.savedAt, 0);
  const stats = record(data.stats);
  if (stats) {
    save.stats = {
      bought: nonNegative(stats.bought, 0),
      earned: nonNegative(stats.earned, 0),
      stolen: nonNegative(stats.stolen, 0),
      lost: nonNegative(stats.lost, 0),
    };
  }
  if (Array.isArray(data.slots)) {
    data.slots.slice(0, ECONOMY.totalSlots).forEach((slot: unknown, i) => {
      const s = record(slot);
      if (!s || i >= save.unlocked) return;
      if (typeof s.id === 'string' && knownIds.has(s.id)) save.slots[i] = { id: s.id, stored: nonNegative(s.stored, 0) };
    });
  }
  if (Array.isArray(data.neighbors) && data.neighbors.length === NEIGHBORS.length) {
    save.neighbors = data.neighbors.map((neighbor: unknown) => {
      const slots = record(neighbor)?.slots;
      return {
        slots: Array.from({ length: BOT.slots }, (_, i) => {
          const id = Array.isArray(slots) ? slots[i] : null;
          return typeof id === 'string' && knownIds.has(id) ? id : null;
        }),
      };
    });
  }
  const upgrades = record(data.upgrades);
  if (upgrades) {
    for (const id of UPGRADE_IDS) save.upgrades[id] = Math.min(maxLevel(id), Math.floor(nonNegative(upgrades[id], 0)));
  }
  return save;
}
