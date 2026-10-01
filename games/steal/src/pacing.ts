// Модель прохождения для баланса экономики: «игрок» по простым правилам покупает на дорожке,
// открывает места, качается, открывает кейсы, крутит колесо, крадёт у соседей, теряет персонажей
// в набегах и перерождается, а модель записывает, когда он дошёл до вех. Числа и правила — настоящие
// (config.ts, economy.ts, cases.ts, neighbors.ts…), поэтому после правки баланса pacing.test.ts
// сразу показывает, как изменился темп. Графики, ходьбы и погонь здесь нет — только время и шансы.
import { clamp } from '@engine/math';
import { Rng } from '@engine/rng';
import { BOT, CARPET, GOLD, NEIGHBORS, RAID } from './config';
import { isFirstCase, payForCase, rollCase } from './cases';
import { claimDaily } from './daily';
import { CASES, caseById, FREE_CASE_ID, type CaseDef } from './data/cases';
import { CHARACTERS, characterById, type CharacterDef } from './data/characters';
import { RARITY_ORDER, type Rarity } from './data/rarity';
import { baseIncome, findSlotFor, sellValue, slotUnit, steadyIncome, totalIncome, unitIncome, unitPrice, unlockCost, type SlotChoice } from './economy';
import { characterNearTier, createNeighborRoster, neighborSlotFor, pickRaidTarget, playerPower, rollNeighborCharacter } from './neighbors';
import { offlineEarnings } from './offline';
import { canRebirth, rebirth } from './rebirth';
import { rivalLevel } from './rivals';
import { createSave, TUTORIAL_DONE, type SaveData, type UnitSave } from './save';
import { Spawner } from './spawner';
import { buyUpgrade, upgradeCost, UPGRADE_IDS, type UpgradeLevels } from './upgrades';
import { coinsPrize, rollWheel, spinState, startBoost, useSpin, WHEEL, WHEEL_CHARACTER_GOLD } from './wheel';

/** Как играет модельный игрок. */
export interface PacingPlayer {
  readonly name: string;
  /** Сколько секунд уходит на покупку на дорожке: добежать и купить. */
  readonly buyTime: number;
  /** Как часто обходит плиты и собирает монеты, секунды. */
  readonly collectEvery: number;
  /** Раз в сколько секунд идёт красть (0 — крадёт только в обучении) и сколько длится кража. */
  readonly stealEvery: number;
  readonly stealTime: number;
  /**
   * Удача кражи у соседа 1-го уровня без прокачки — у Жорика и у Тимура.
   * Каждый уровень соседа сверх первого отнимает 0,1, уровень кроссовок и веника прибавляет 0,05.
   */
  readonly stealSuccess: readonly [number, number];
  /** Шанс, что набег удастся (игрок не отбился); каждый уровень щеколды снижает его на 20%. */
  readonly raidLoss: number;
  /** Открывает кейс за монеты, когда монет больше его цены в столько раз (0 — не открывает), но не чаще раза в caseEvery секунд. */
  readonly caseWealth: number;
  readonly caseEvery: number;
  /** Крутит колесо за рекламу (3 раза в день). */
  readonly adSpins: boolean;
}

/**
 * Два типичных игрока. Спокойный покупает на дорожке и качается, крадёт только в обучении,
 * кейсы открывает бесплатные и по ключам, отбивается от трёх набегов из четырёх. Активный ещё и крадёт
 * раз в две минуты, открывает кейс за монеты (когда монет вчетверо больше цены), крутит колесо за рекламу.
 */
export const PLAYERS = {
  casual: {
    name: 'спокойный',
    buyTime: 5,
    collectEvery: 30,
    stealEvery: 0,
    stealTime: 40,
    stealSuccess: [1, 1],
    raidLoss: 0.25,
    caseWealth: 0,
    caseEvery: 0,
    adSpins: false,
  },
  active: {
    name: 'активный',
    buyTime: 3,
    collectEvery: 15,
    stealEvery: 120,
    stealTime: 35,
    stealSuccess: [0.85, 0.7],
    raidLoss: 0.15,
    caseWealth: 4,
    caseEvery: 120,
    adSpins: true,
  },
} as const satisfies Record<string, PacingPlayer>;

/** Вехи прохождения: первый персонаж каждой редкости, «Голда», все места, доход, перерождения. */
export type Milestone =
  | Exclude<Rarity, 'common' | 'secret'>
  | 'gold'
  | 'allSlots'
  | 'income100'
  | 'income1k'
  | 'income10k'
  | 'rebirth1'
  | 'rebirth2'
  | 'rebirth3';

export const MILESTONES: readonly Milestone[] = ['rare', 'epic', 'legendary', 'mythic', 'gold', 'allSlots', 'income100', 'income1k', 'income10k', 'rebirth1', 'rebirth2', 'rebirth3'];

const REBIRTH_MILESTONES: readonly Milestone[] = ['rebirth1', 'rebirth2', 'rebirth3'];

const INCOME_MILESTONES: readonly [Milestone, number][] = [
  ['income100', 100],
  ['income1k', 1000],
  ['income10k', 10000],
];

interface Walker {
  readonly def: CharacterDef;
  readonly gold: boolean;
  /** Когда уйдёт с дорожки, секунды модели. */
  readonly leaves: number;
}

/** Полный проход дорожки, секунды. */
const CARPET_TIME = (CARPET.endX - CARPET.startX) / CARPET.walkSpeed;
/** Шаг модели, секунды. */
const STEP = 1;

export class PacingSim {
  readonly save: SaveData = createSave();
  readonly player: PacingPlayer;
  /** Секунды с начала игры, вместе с отлучками. */
  time = 0;
  /** Сколько из них игрока не было (away). */
  private awayTotal = 0;
  /** Когда впервые дошли до вехи — секунды игры, без отлучек. */
  readonly milestones = new Map<Milestone, number>();
  /** Прокачка игрока в момент, когда Тимур впервые дорос до уровня (ключ — уровень 1…5). */
  readonly rivalUpgrades = new Map<number, UpgradeLevels>();
  /** Счётчики: сколько купили, украли, потеряли в набегах, открыли кейсов. */
  readonly counts = { bought: 0, stolen: 0, stealFailed: 0, raided: 0, cases: 0, spins: 0 };
  private readonly rng: Rng;
  private readonly spawner: Spawner;
  private walkers: Walker[] = [];
  private neighbors: (UnitSave | null)[][];
  private refillAt: number[];
  /** Монеты на плитах, ещё не собранные. */
  private pending = 0;
  private nextCollect: number;
  private busyUntil = 0;
  private nextSteal = 0;
  private raidAt: number = RAID.firstDelay;
  private nextCase = 0;
  private dailyClaimed = false;

  constructor(player: PacingPlayer, seed: number) {
    this.player = player;
    this.rng = new Rng(seed);
    this.spawner = new Spawner(this.rng, CHARACTERS, CARPET.spawnInterval);
    this.nextCollect = player.collectEvery;
    // как в игре: дорожка уже заполнена, а к игроку идёт самый дешёвый (обучение)
    this.prefillCarpet();
    const cheapest = CHARACTERS.reduce((a, b) => (b.price < a.price ? b : a));
    this.walkers.push({ def: cheapest, gold: false, leaves: CARPET_TIME * 0.5 });
    this.neighbors = this.rosters();
    this.refillAt = NEIGHBORS.map(() => this.rng.range(...BOT.refillInterval));
  }

  /** Миллисекунды для логики, считающей время по Date.now (ускоритель, таймеры кейса и колеса). */
  get now(): number {
    return this.time * 1000;
  }

  /** Секунды игры без отлучек. */
  get played(): number {
    return this.time - this.awayTotal;
  }

  /** Играть ещё столько секунд. */
  run(seconds: number): this {
    const until = this.played + seconds;
    while (this.played < until) this.step();
    return this;
  }

  /**
   * Игрок ушёл на столько секунд и вернулся: доход вне игры (с рекламой — вдвое больше),
   * дорожка заново, таймеры кейса и колеса тикали. Возвращает, сколько монет он получил.
   */
  away(seconds: number, watchAd: boolean): number {
    const { save } = this;
    save.savedAt = this.now;
    this.time += seconds;
    this.awayTotal += seconds;
    const earned = offlineEarnings(save, this.now);
    const coins = earned ? earned.coins * (watchAd ? 2 : 1) : 0;
    save.coins += coins;
    save.stats.earned += coins;
    this.walkers = [];
    this.prefillCarpet();
    this.busyUntil = this.time;
    this.nextCollect = this.time + this.player.collectEvery;
    this.nextSteal = this.time + this.player.stealEvery;
    this.raidAt = this.time + RAID.firstDelay;
    this.dailyClaimed = false;
    return coins;
  }

  step(): void {
    this.time += STEP;
    this.updateCarpet();
    this.earn();
    this.refillNeighbors();
    this.raids();
    // подарки и вехи — раз в несколько секунд: так модель быстрее, а темп тот же
    if (this.time % 5 === 0) this.freebies();
    if (this.time >= this.busyUntil) this.act();
    if (canRebirth(this.save) && this.save.tutorial >= TUTORIAL_DONE) this.rebirth();
    if (this.time % 5 === 0) this.checkMilestones();
  }

  // ---------------------------------------------------------------- мир

  private prefillCarpet(): void {
    for (let i = 0; i < 9; i++) this.walkers.push({ def: this.spawner.pick(), gold: false, leaves: this.time + CARPET_TIME * (0.94 - i * 0.105) });
  }

  private updateCarpet(): void {
    const next = this.spawner.update(STEP);
    if (next && this.walkers.length < CARPET.maxWalkers) {
      this.walkers.push({ def: next, gold: this.rng.chance(GOLD.carpetChance), leaves: this.time + CARPET_TIME });
    }
    this.walkers = this.walkers.filter((w) => w.leaves > this.time);
  }

  private earn(): void {
    const { save } = this;
    this.pending += totalIncome(save, this.now) * STEP;
    save.stats.peakIncome = Math.max(save.stats.peakIncome, baseIncome(save));
    if (this.time >= this.nextCollect) {
      save.coins += this.pending;
      save.stats.earned += this.pending;
      this.pending = 0;
      this.nextCollect = this.time + this.player.collectEvery;
    }
  }

  private rosters(): (UnitSave | null)[][] {
    const power = playerPower(this.save.slots);
    return NEIGHBORS.map((n) => createNeighborRoster(this.rng, CHARACTERS, power, BOT.slots, GOLD.neighborChance, n.loot));
  }

  /** Соседи докупают персонажей под силу игрока — как Neighborhood.updateRefill. */
  private refillNeighbors(): void {
    NEIGHBORS.forEach((config, i) => {
      if (this.time < this.refillAt[i]) return;
      this.refillAt[i] = this.time + this.rng.range(...BOT.refillInterval);
      const slots = this.neighbors[i];
      const def = rollNeighborCharacter(this.rng, CHARACTERS, playerPower(this.save.slots), config.loot);
      const gold = this.rng.chance(GOLD.neighborChance);
      let slot = slots.indexOf(null);
      if (slot < 0 && this.rng.chance(0.35)) slot = neighborSlotFor(slots, def, gold);
      if (slot >= 0) slots[slot] = { id: def.id, gold };
    });
  }

  /** Набеги: раз в RAID.interval сосед идёт за самым доходным; удаётся с шансом raidLoss. */
  private raids(): void {
    const { save } = this;
    const seated = save.slots.filter((s) => s.id).length;
    const ready = seated >= RAID.minResidents && (save.tutorial >= TUTORIAL_DONE || this.played > 300);
    if (!ready || this.time < this.raidAt) return;
    this.raidAt = this.time + this.rng.range(...RAID.interval);
    const loss = this.player.raidLoss * Math.max(0.2, 1 - 0.2 * save.upgrades.latch);
    if (!this.rng.chance(loss)) return;
    const target = pickRaidTarget(save.slots, () => true);
    const unit = slotUnit(save.slots[target]);
    if (!unit) return;
    save.slots[target] = { id: null, gold: false, stored: 0 };
    this.counts.raided++;
    // добыча садится на полок вора — её можно украсть обратно
    const thief = this.neighbors[this.rng.int(0, this.neighbors.length)];
    const slot = neighborSlotFor(thief, unit.def, unit.gold);
    if (slot >= 0) thief[slot] = { id: unit.def.id, gold: unit.gold };
  }

  // ---------------------------------------------------------------- бесплатное

  /**
   * Бесплатный спин и спины за рекламу (подряд, как в окне колеса), потом бесплатный кейс
   * и кейсы по ключам, первая награда за вход.
   */
  private freebies(): void {
    const { save } = this;
    const now = this.now;
    // отметки на кнопках игрок замечает, когда обучение пройдено
    if (save.tutorial < TUTORIAL_DONE) return;
    if (spinState(save, now).free && useSpin(save, now, 'free')) this.spin();
    while (this.player.adSpins && spinState(save, now).adLeft > 0 && useSpin(save, now, 'ad')) this.spin();
    const bath = caseById(FREE_CASE_ID);
    if (bath && save.freeCaseAt <= now) this.openCase(bath);
    for (const box of CASES) while ((save.keys[box.id] ?? 0) > 0) this.openCase(box);
    if (!this.dailyClaimed) {
      this.dailyClaimed = true;
      const claimed = claimDaily(save, now, totalIncome(save, now));
      if (claimed) save.stats.earned += claimed.coins;
    }
  }

  private openCase(box: CaseDef): void {
    const first = isFirstCase(this.save);
    if (!payForCase(this.save, box, this.now)) return;
    this.counts.cases++;
    const drop = rollCase(this.rng, box, CHARACTERS, first);
    this.reward(drop.def, drop.gold);
  }

  private spin(): void {
    const { save } = this;
    this.counts.spins++;
    const prize = WHEEL[rollWheel(this.rng)].prize;
    if (prize.kind === 'coins') save.coins += coinsPrize(prize, totalIncome(save, this.now));
    else if (prize.kind === 'key') save.keys[prize.caseId] = (save.keys[prize.caseId] ?? 0) + 1;
    else if (prize.kind === 'boost') startBoost(save, this.now);
    else this.reward(characterNearTier(this.rng, CHARACTERS, Math.max(0, playerPower(save.slots))), this.rng.chance(WHEEL_CHARACTER_GOLD));
  }

  /** Персонаж из кейса или колеса: на полок, а если не лучше слабого — продаётся за полцены. */
  private reward(def: CharacterDef, gold: boolean): void {
    const choice = findSlotFor(this.save, def, gold);
    if (choice) this.place(def, gold, choice);
    else this.save.coins += sellValue(def, gold);
  }

  // ---------------------------------------------------------------- решения игрока

  private act(): void {
    if (this.wantsSteal()) {
      this.steal();
      return;
    }
    const walker = this.chooseWalker();
    if (walker && walker !== 'wait') {
      this.buy(walker);
      return;
    }
    if (this.unlockSlot() || walker === 'wait') return;
    if (this.upgrade()) return;
    this.buyCase();
  }

  /**
   * Кого купить на дорожке: самого доходного из тех, кто улучшит полок. Если на него
   * не хватает, но накопится, пока он не ушёл, — игрок копит ('wait'), иначе берёт лучшего по карману.
   */
  private chooseWalker(): Walker | 'wait' | null {
    const { save } = this;
    const income = (w: Walker) => unitIncome(w.def, w.gold);
    // как findSlotFor: на свободное место годится любой, иначе — только доходнее самого слабого
    const floor = this.shelfFloor();
    const useful = this.walkers.filter((w) => income(w) > floor);
    if (useful.length === 0) return null;
    const best = useful.reduce((a, b) => (income(b) > income(a) ? b : a));
    const price = unitPrice(best.def, best.gold);
    if (save.coins >= price) return best;
    const eta = (price - save.coins - this.pending) / Math.max(totalIncome(save, this.now), 1e-6);
    if (this.time + Math.max(eta, this.player.collectEvery / 2) + this.player.buyTime < best.leaves) return 'wait';
    const affordable = useful.filter((w) => save.coins >= unitPrice(w.def, w.gold));
    return affordable.length > 0 ? affordable.reduce((a, b) => (income(b) > income(a) ? b : a)) : null;
  }

  /** Доход самого слабого на открытых местах или −1, если есть свободное место. */
  private shelfFloor(): number {
    const { save } = this;
    let floor = Infinity;
    for (let i = 0; i < save.unlocked; i++) {
      const unit = slotUnit(save.slots[i]);
      if (!unit) return -1;
      floor = Math.min(floor, unitIncome(unit.def, unit.gold));
    }
    return floor;
  }

  private buy(walker: Walker): void {
    const choice = findSlotFor(this.save, walker.def, walker.gold);
    if (!choice) return;
    this.save.coins -= unitPrice(walker.def, walker.gold);
    this.place(walker.def, walker.gold, choice);
    this.walkers = this.walkers.filter((w) => w !== walker);
    this.counts.bought++;
    if (this.save.tutorial === 0) this.save.tutorial = 2;
    this.busyUntil = this.time + this.player.buyTime;
  }

  private place(def: CharacterDef, gold: boolean, choice: SlotChoice): void {
    const { save } = this;
    if (choice.replaces) save.coins += sellValue(choice.replaces.def, choice.replaces.gold);
    save.slots[choice.slot] = { id: def.id, gold, stored: 0 };
    const key = gold ? `${def.id}:gold` : def.id;
    if (!save.collection.includes(key)) save.collection.push(key);
  }

  private unlockSlot(): boolean {
    const { save } = this;
    const cost = unlockCost(save.unlocked);
    const full = save.slots.slice(0, save.unlocked).every((s) => s.id);
    if (cost === null || !full || save.coins < cost) return false;
    save.coins -= cost;
    save.unlocked++;
    this.busyUntil = this.time + 2;
    return true;
  }

  /** Самый дешёвый доступный уровень прокачки — так игрок и покупает, когда горит отметка. */
  private upgrade(): boolean {
    const { save } = this;
    let cheapest: { id: (typeof UPGRADE_IDS)[number]; cost: number } | null = null;
    for (const id of UPGRADE_IDS) {
      const cost = upgradeCost(id, save.upgrades[id]);
      if (cost !== null && cost <= save.coins && (!cheapest || cost < cheapest.cost)) cheapest = { id, cost };
    }
    if (!cheapest || !buyUpgrade(save, cheapest.id)) return false;
    this.busyUntil = this.time + 2;
    return true;
  }

  /** Кейс за монеты — самый дорогой из тех, на которые монет с запасом. */
  private buyCase(): void {
    const wealth = this.player.caseWealth;
    if (wealth <= 0 || this.time < this.nextCase) return;
    const box = [...CASES].reverse().find((c) => c.price * wealth <= this.save.coins);
    if (!box) return;
    this.openCase(box);
    this.nextCase = this.time + this.player.caseEvery;
    this.busyUntil = this.time + 6;
  }

  private wantsSteal(): boolean {
    const { save } = this;
    if (save.tutorial < TUTORIAL_DONE) return save.slots.filter((s) => s.id).length >= 2 && this.played >= 45;
    return this.player.stealEvery > 0 && this.time >= this.nextSteal;
  }

  /** Кража самого доходного персонажа соседей, который улучшит полок. Первая (обучение) удаётся всегда. */
  private steal(): void {
    const { save } = this;
    const tutorial = save.tutorial < TUTORIAL_DONE;
    let found: { n: number; slot: number; def: CharacterDef; gold: boolean } | null = null;
    for (const [n, slots] of this.neighbors.entries()) {
      for (const [slot, unit] of slots.entries()) {
        const def = unit ? characterById(unit.id) : undefined;
        if (!unit || !def || !findSlotFor(save, def, unit.gold)) continue;
        if (!found || unitIncome(def, unit.gold) > unitIncome(found.def, found.gold)) found = { n, slot, def, gold: unit.gold };
      }
    }
    this.nextSteal = this.time + (this.player.stealEvery || Infinity);
    if (!found) {
      if (tutorial) save.tutorial = TUTORIAL_DONE;
      return;
    }
    this.busyUntil = this.time + this.player.stealTime;
    if (!tutorial && !this.rng.chance(this.stealChance(found.n))) {
      this.counts.stealFailed++;
      return;
    }
    this.neighbors[found.n][found.slot] = null;
    const choice = findSlotFor(save, found.def, found.gold);
    if (choice) this.place(found.def, found.gold, choice);
    this.counts.stolen++;
    if (tutorial) save.tutorial = TUTORIAL_DONE;
    // обиженный сосед мстит раньше обычного набега
    else this.raidAt = Math.min(this.raidAt, this.time + this.rng.range(20, 35));
  }

  private stealChance(n: number): number {
    const { save } = this;
    const level = rivalLevel(save.stats.peakIncome, NEIGHBORS[n].levelOffset);
    const skill = 0.05 * (save.upgrades.speed + save.upgrades.broom);
    return clamp(this.player.stealSuccess[n] - 0.1 * (level - 1) + skill, 0.05, 0.95);
  }

  private rebirth(): void {
    if (!rebirth(this.save)) return;
    this.pending = 0;
    this.neighbors = this.rosters();
    const key = REBIRTH_MILESTONES[this.save.rebirths - 1];
    if (key && !this.milestones.has(key)) this.milestones.set(key, this.played);
  }

  private checkMilestones(): void {
    const { save } = this;
    const mark = (m: Milestone) => {
      if (!this.milestones.has(m)) this.milestones.set(m, this.played);
    };
    for (const slot of save.slots) {
      const unit = slotUnit(slot);
      if (!unit) continue;
      const tier = RARITY_ORDER.indexOf(unit.def.rarity);
      for (const r of ['rare', 'epic', 'legendary', 'mythic'] as const) if (tier >= RARITY_ORDER.indexOf(r)) mark(r);
      if (unit.gold) mark('gold');
    }
    if (unlockCost(save.unlocked) === null && save.unlocked > 0 && save.slots.every((s) => s.id)) mark('allSlots');
    const income = steadyIncome(save);
    for (const [m, threshold] of INCOME_MILESTONES) if (income >= threshold) mark(m);
    const level = rivalLevel(save.stats.peakIncome);
    if (!this.rivalUpgrades.has(level)) this.rivalUpgrades.set(level, { ...save.upgrades });
  }
}

/** «12:30» — минуты и секунды. */
export function formatClock(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
