// Прокачка без графики: цены уровней и что они дают — их легко тестировать.
import { BROOM, LOCK, UPGRADES } from './config';
import { formatSeconds, t } from './i18n';
import type { SaveData } from './save';

export type UpgradeId = keyof typeof UPGRADES;
export type UpgradeLevels = Record<UpgradeId, number>;

export const UPGRADE_IDS = Object.keys(UPGRADES) as readonly UpgradeId[];

export function createUpgradeLevels(): UpgradeLevels {
  return { speed: 0, broom: 0, latch: 0, stove: 0 };
}

export function maxLevel(id: UpgradeId): number {
  return UPGRADES[id].costs.length;
}

/** Цена следующего уровня или null, если прокачано до конца. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  const costs: readonly number[] = UPGRADES[id].costs;
  return level >= 0 && level < costs.length ? costs[level] : null;
}

export type UpgradeCheck = { readonly ok: true; readonly cost: number } | { readonly ok: false; readonly reason: 'max' | 'coins' };

/** Можно ли купить следующий уровень. */
export function checkUpgrade(save: SaveData, id: UpgradeId): UpgradeCheck {
  const cost = upgradeCost(id, save.upgrades[id]);
  if (cost === null) return { ok: false, reason: 'max' };
  return save.coins >= cost ? { ok: true, cost } : { ok: false, reason: 'coins' };
}

/** Покупает следующий уровень. false — не хватает монет или уровень последний. */
export function buyUpgrade(save: SaveData, id: UpgradeId): boolean {
  const check = checkUpgrade(save, id);
  if (!check.ok) return false;
  save.coins -= check.cost;
  save.upgrades[id]++;
  return true;
}

/** Во сколько раз быстрее бегает игрок. */
export function speedMultiplier(levels: UpgradeLevels): number {
  return 1 + UPGRADES.speed.perLevel * levels.speed;
}

/** Сколько секунд сосед оглушён после удара веником. */
export function broomStun(levels: UpgradeLevels): number {
  return BROOM.stun + UPGRADES.broom.stunPerLevel * levels.broom;
}

/** Перезарядка веника, секунды. */
export function broomCooldown(levels: UpgradeLevels): number {
  return BROOM.cooldown - UPGRADES.broom.cooldownPerLevel * levels.broom;
}

/** На сколько секунд щеколда закрывает баню. */
export function latchDuration(levels: UpgradeLevels): number {
  return LOCK.duration + UPGRADES.latch.secondsPerLevel * levels.latch;
}

/** Во сколько раз больше монет приносят персонажи. */
export function incomeMultiplier(levels: UpgradeLevels): number {
  return 1 + UPGRADES.stove.perLevel * levels.stove;
}

const percent = (fraction: number) => `${Math.round(fraction * 100)}%`;

/** Что даёт уровень — текст для панели прокачки. */
export function describeUpgrade(id: UpgradeId, level: number): string {
  const levels = { ...createUpgradeLevels(), [id]: level };
  const text = t.upgrades;
  switch (id) {
    case 'speed':
      return level === 0 ? text.speedBase : text.speed(percent(speedMultiplier(levels) - 1));
    case 'broom':
      return text.broom(formatSeconds(broomStun(levels)), formatSeconds(broomCooldown(levels)));
    case 'latch':
      return text.latch(formatSeconds(latchDuration(levels)));
    case 'stove':
      return level === 0 ? text.stoveBase : text.stove(percent(incomeMultiplier(levels) - 1));
  }
}
