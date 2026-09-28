import type { Rng } from '@engine/rng';
import type { CharacterDef } from './data/characters';
import { RARITIES, RARITY_ORDER } from './data/rarity';

/**
 * Выбирает персонажа: сначала редкость по весам (учитываются только редкости,
 * которые есть в списке), потом персонажа этой редкости. rollRarity и rollCharacter — числа [0, 1).
 */
export function pickCharacter(characters: readonly CharacterDef[], rollRarity: number, rollCharacter: number): CharacterDef {
  const present = RARITY_ORDER.filter((r) => RARITIES[r].weight > 0 && characters.some((c) => c.rarity === r));
  if (present.length === 0) throw new Error('Нет персонажей, которые могут появиться на дорожке');
  const total = present.reduce((sum, r) => sum + RARITIES[r].weight, 0);
  let roll = rollRarity * total;
  let rarity = present[present.length - 1];
  for (const r of present) {
    roll -= RARITIES[r].weight;
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  const pool = characters.filter((c) => c.rarity === rarity);
  return pool[Math.min(pool.length - 1, Math.floor(rollCharacter * pool.length))];
}

/** Решает, когда и кого выпустить на дорожку. */
export class Spawner {
  private readonly rng: Rng;
  private readonly characters: readonly CharacterDef[];
  private readonly interval: readonly [number, number];
  private timer: number;

  constructor(rng: Rng, characters: readonly CharacterDef[], interval: readonly [number, number]) {
    this.rng = rng;
    this.characters = characters;
    this.interval = interval;
    this.timer = rng.range(interval[0], interval[1]);
  }

  /** Возвращает персонажа, если пора выпускать следующего. */
  update(dt: number): CharacterDef | null {
    this.timer -= dt;
    if (this.timer > 0) return null;
    this.timer += this.rng.range(this.interval[0], this.interval[1]);
    return this.pick();
  }

  pick(): CharacterDef {
    return pickCharacter(this.characters, this.rng.next(), this.rng.next());
  }
}
