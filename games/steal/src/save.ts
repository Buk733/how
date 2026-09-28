import { ECONOMY } from './config';

export interface SlotSave {
  /** id персонажа на месте или null, если место пустое. */
  id: string | null;
  /** Накопленные и ещё не собранные монеты. */
  stored: number;
}

/** Всё, что сохраняется между сессиями. При изменении формата — поднять version и дописать миграцию. */
export interface SaveData {
  version: 1;
  coins: number;
  /** Сколько мест на полке открыто. */
  unlocked: number;
  slots: SlotSave[];
  /** Шаг обучения: 0 — купить персонажа, 1 — собрать монеты, 2 — пройдено. */
  tutorial: number;
  muted: boolean;
  stats: { bought: number; earned: number };
  savedAt: number;
}

export function createSave(): SaveData {
  return {
    version: 1,
    coins: ECONOMY.startCoins,
    unlocked: ECONOMY.freeSlots,
    slots: Array.from({ length: ECONOMY.totalSlots }, () => ({ id: null, stored: 0 })),
    tutorial: 0,
    muted: false,
    stats: { bought: 0, earned: 0 },
    savedAt: 0,
  };
}

const nonNegative = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;

/**
 * Проверяет сохранение, пришедшее из хранилища. Всё сломанное или незнакомое
 * заменяется значениями по умолчанию, неизвестные персонажи убираются.
 */
export function parseSave(raw: unknown, knownIds: ReadonlySet<string>): SaveData {
  const save = createSave();
  if (!raw || typeof raw !== 'object') return save;
  const data = raw as Record<string, unknown>;
  if (data.version !== 1) return save;

  save.coins = nonNegative(data.coins, save.coins);
  save.unlocked = Math.min(ECONOMY.totalSlots, Math.max(ECONOMY.freeSlots, Math.floor(nonNegative(data.unlocked, 0))));
  save.tutorial = Math.floor(nonNegative(data.tutorial, 0));
  save.muted = data.muted === true;
  save.savedAt = nonNegative(data.savedAt, 0);
  if (data.stats && typeof data.stats === 'object') {
    const stats = data.stats as Record<string, unknown>;
    save.stats = { bought: nonNegative(stats.bought, 0), earned: nonNegative(stats.earned, 0) };
  }
  if (Array.isArray(data.slots)) {
    data.slots.slice(0, ECONOMY.totalSlots).forEach((slot: unknown, i) => {
      if (!slot || typeof slot !== 'object' || i >= save.unlocked) return;
      const { id, stored } = slot as Record<string, unknown>;
      if (typeof id === 'string' && knownIds.has(id)) save.slots[i] = { id, stored: nonNegative(stored, 0) };
    });
  }
  return save;
}
