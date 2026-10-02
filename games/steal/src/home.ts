import * as THREE from 'three';
import { formatNumber } from '@engine/format';
import { clamp, distanceXZ, type PointXZ } from '@engine/math';
import type { SpriteSheet } from '@engine/sprite';
import { PLATE_RADIUS } from './config';
import type { Action, GameContext } from './context';
import { characterById, type CharacterDef } from './data/characters';
import { shelfLine } from './data/phrases';
import { findSlotFor, incomeFactor, sellValue, unitIncome, unlockCost, type SlotChoice, type Unit } from './economy';
import type { Brainrot } from './entities/brainrot';
import { SpeechBubble } from './entities/bubble';
import { Plate } from './entities/plate';
import { t } from './i18n';
import { pickRaidTarget } from './neighbors';
import { latchDuration } from './upgrades';

/** Как часто кто-нибудь на полке что-то говорит и как часто печь «поддаёт пар», секунды. */
const CHATTER_INTERVAL: readonly [number, number] = [6, 11];
const STEAM_INTERVAL: readonly [number, number] = [25, 40];
/** Звук пара слышно, только если игрок недалеко от своей бани. */
const STEAM_HEARING = 18;

/** Что стало с наградой из кейса или колеса. */
export type RewardResult =
  | { readonly kind: 'placed'; readonly slot: number; readonly replaced: Unit | null }
  | { readonly kind: 'sold'; readonly coins: number };

/** Баня игрока: персонажи на полке, плиты сбора, открытие мест и щеколда. */
export class Home {
  readonly residents: (Brainrot | null)[];
  private readonly ctx: GameContext;
  private readonly plates: Plate[];
  private readonly lockPlate: Plate;
  /** Реплика одного из персонажей на полке. */
  private readonly chatter: SpeechBubble;
  private chatterTimer: number;
  private chatterFrom: Brainrot | null = null;
  private steamTimer: number;
  private lockedUntil = 0;
  private lastCollectText = 0;

  constructor(ctx: GameContext, plateSheet: SpriteSheet) {
    this.ctx = ctx;
    this.chatter = new SpeechBubble(ctx.labels.create('say-bubble shelf-say'));
    this.chatterTimer = ctx.rng.range(...CHATTER_INTERVAL);
    this.steamTimer = ctx.rng.range(...STEAM_INTERVAL);
    const layout = ctx.world.home;
    const sign = ctx.labels.create('world-sign');
    sign.element.textContent = t.home.sign;
    sign.anchor.copy(layout.signAnchor);

    this.plates = layout.plates.map((position) => {
      const plate = new Plate(plateSheet, position, ctx.labels.create('plate-tag'));
      ctx.scene.add(plate.mesh);
      return plate;
    });
    this.lockPlate = new Plate(plateSheet, ctx.world.lockButton, ctx.labels.create('plate-tag lock-tag'));
    this.lockPlate.setState('latch');
    ctx.scene.add(this.lockPlate.mesh);

    this.residents = ctx.save.slots.map((slot, i) => {
      const def = slot.id ? characterById(slot.id) : undefined;
      if (!def) return null;
      const resident = ctx.createBrainrot(def, slot.gold);
      resident.seatAt(i, layout.seats[i]);
      return resident;
    });
  }

  /** Закрыта ли баня на щеколду. */
  get locked(): boolean {
    return this.ctx.time < this.lockedUntil;
  }

  /** Сколько персонажей сидит на полке. */
  get seatedCount(): number {
    return this.residents.filter((r) => r?.state === 'seated').length;
  }

  /** Персонажи, которые сидят на полке (для парилки). */
  seatedUnits(): { readonly slot: number; readonly def: CharacterDef; readonly gold: boolean }[] {
    return this.residents.flatMap((r, slot) => (r?.state === 'seated' ? [{ slot, def: r.def, gold: r.gold }] : []));
  }

  isInside(p: PointXZ): boolean {
    const r = this.ctx.world.home.interior;
    return p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;
  }

  update(dt: number): void {
    const { save, player } = this.ctx;
    const factor = incomeFactor(save, Date.now());
    for (let i = 0; i < this.residents.length; i++) {
      const resident = this.residents[i];
      const slot = save.slots[i];
      const plate = this.plates[i];
      if (resident) {
        resident.update(dt);
        if (resident.state === 'seated') slot.stored += unitIncome(resident.def, resident.gold) * factor * dt;
      }

      if (i >= save.unlocked) {
        plate.setState('locked');
        const cost = unlockCost(i);
        plate.setText(i === save.unlocked && cost !== null ? `🔒 ${formatNumber(cost)}` : '');
        continue;
      }
      const stored = Math.floor(slot.stored);
      plate.setState(stored > 0 ? 'ready' : 'empty');
      plate.setText(resident || stored > 0 ? `💰 ${formatNumber(stored)}` : '');
      if (stored > 0 && distanceXZ(player.position, plate.mesh.position) < PLATE_RADIUS) this.collect(i, stored);
    }

    const locked = this.locked;
    this.ctx.world.home.barrier.visible = locked;
    this.lockPlate.setText(locked ? t.home.latchLeft(Math.ceil(this.lockedUntil - this.ctx.time)) : t.home.latch);
    this.updateChatter(dt);
    this.updateSteam(dt);
  }

  /** Время от времени кто-нибудь на полке что-то говорит. */
  private updateChatter(dt: number): void {
    const from = this.chatterFrom;
    if (from && this.chatter.visible) {
      this.chatter.update(dt, from.position.clone().setY(from.position.y + 2.1));
      if (from.state !== 'seated') this.chatter.hide();
    }
    this.chatterTimer -= dt;
    if (this.chatterTimer > 0) return;
    this.chatterTimer = this.ctx.rng.range(...CHATTER_INTERVAL);
    const seated = this.residents.filter((r): r is Brainrot => r?.state === 'seated');
    if (seated.length === 0) return;
    const speaker = seated[this.ctx.rng.int(0, seated.length)];
    this.chatterFrom = speaker;
    this.chatter.say(shelfLine(speaker.def.id, this.ctx.rng), 2.4);
    this.chatter.update(0, speaker.position.clone().setY(speaker.position.y + 2.1));
  }

  /** Печь иногда «поддаёт пар»: клубы над полком, шипение, «Кайф!». */
  private updateSteam(dt: number): void {
    this.steamTimer -= dt;
    if (this.steamTimer > 0) return;
    const { rng, world, player } = this.ctx;
    this.steamTimer = rng.range(...STEAM_INTERVAL);
    const stove = world.home.stove;
    // печь справа, полок слева — пар плывёт на полок
    this.ctx.fx.steam(stove.clone().setY(stove.y + 0.2), 2.5, -2.2);
    if (distanceXZ(player.position, stove) < STEAM_HEARING) this.ctx.audio.blip('hiss');
    const seated = this.residents.filter((r): r is Brainrot => r?.state === 'seated');
    if (seated.length === 0) return;
    this.chatterFrom = seated[rng.int(0, seated.length)];
    this.chatter.say(t.home.chatter, 2.2);
    this.chatterTimer = Math.max(this.chatterTimer, 3);
  }

  findAction(): Action | null {
    const { save, player } = this.ctx;
    if (distanceXZ(player.position, this.lockPlate.mesh.position) < PLATE_RADIUS + 0.3) {
      const locked = this.locked;
      return {
        view: locked
          ? { title: t.home.closedTitle, detail: t.home.closedLeft(Math.ceil(this.lockedUntil - this.ctx.time)), enabled: false }
          : { title: t.home.closeTitle, detail: t.home.closeDetail(latchDuration(this.ctx.save.upgrades)), enabled: true },
        run: () => this.lock(),
      };
    }
    const next = save.unlocked;
    const cost = unlockCost(next);
    if (cost !== null && distanceXZ(player.position, this.plates[next].mesh.position) < PLATE_RADIUS + 0.3) {
      return {
        view: { title: t.home.unlockTitle, detail: `💰 ${formatNumber(cost)}`, enabled: save.coins >= cost },
        run: () => this.unlockSlot(next, cost),
      };
    }
    return null;
  }

  /**
   * Сажает персонажа на выбранное место. Если там кто-то сидит — его «продают» за полцены.
   * Персонаж сам дойдёт до полка от того места, где стоит.
   */
  place(brainrot: Brainrot, choice: SlotChoice): void {
    const { save, labels } = this.ctx;
    const old = this.residents[choice.slot];
    const leftover = Math.floor(save.slots[choice.slot].stored);
    if (old) {
      const refund = sellValue(old.def, old.gold) + leftover;
      save.coins += refund;
      labels.float(`+${formatNumber(refund)}`, old.position.clone().setY(1.8), 'float-coins');
      this.ctx.removeBrainrot(old);
    } else if (leftover > 0) {
      // монеты, оставшиеся на плите от украденного персонажа, не пропадают
      save.coins += leftover;
    }
    save.slots[choice.slot] = { id: brainrot.def.id, gold: brainrot.gold, stored: 0 };
    this.residents[choice.slot] = brainrot;
    brainrot.sendTo(choice.slot, this.pathTo(choice.slot, brainrot.position));
    this.ctx.collect(brainrot.def, brainrot.gold, brainrot.position.clone().setY(2.6));
    this.ctx.markDirty(true);
  }

  /** Игрок принёс персонажа (украл у соседа). false — места нет. */
  deposit(brainrot: Brainrot): boolean {
    const choice = findSlotFor(this.ctx.save, brainrot.def, brainrot.gold);
    if (!choice) return false;
    this.place(brainrot, choice);
    return true;
  }

  /**
   * Награда из кейса или колеса: персонаж выходит к бане и садится на полок, как купленный.
   * Если места нет и он не лучше самого слабого — продаётся за полцены.
   */
  placeReward(def: CharacterDef, gold: boolean): RewardResult {
    const choice = findSlotFor(this.ctx.save, def, gold);
    if (!choice) {
      const coins = sellValue(def, gold);
      this.ctx.save.coins += coins;
      this.ctx.collect(def, gold, this.ctx.player.position.clone().setY(2.6));
      this.ctx.markDirty(true);
      return { kind: 'sold', coins };
    }
    const brainrot = this.ctx.createBrainrot(def, gold);
    const entrance = this.entranceNear(this.ctx.player.position.x);
    brainrot.position.set(entrance.x, 0, entrance.z + 0.8);
    this.place(brainrot, choice);
    return { kind: 'placed', slot: choice.slot, replaced: choice.replaces };
  }

  /** Парилка: персонаж на месте превращается в другого (монеты на плите остаются). */
  replaceInSlot(slot: number, def: CharacterDef, gold: boolean): void {
    const old = this.residents[slot];
    if (old) this.ctx.removeBrainrot(old);
    const brainrot = this.ctx.createBrainrot(def, gold);
    brainrot.seatAt(slot, this.ctx.world.home.seats[slot]);
    this.residents[slot] = brainrot;
    const saved = this.ctx.save.slots[slot];
    this.ctx.save.slots[slot] = { id: def.id, gold, stored: saved.stored };
    this.ctx.labels.float('♨️', brainrot.position.clone().setY(2.2), 'float-coins', 1400);
    this.ctx.collect(def, gold, brainrot.position.clone().setY(2.8));
    this.ctx.markDirty(true);
  }

  /** Парилка: персонаж не выдержал жара и исчез. Монеты на плите остаются. */
  removeFromSlot(slot: number): void {
    const old = this.residents[slot];
    if (!old) return;
    this.ctx.labels.float('💨', old.position.clone().setY(2), 'float-spend', 1400);
    this.ctx.removeBrainrot(old);
    this.residents[slot] = null;
    const saved = this.ctx.save.slots[slot];
    this.ctx.save.slots[slot] = { id: null, gold: false, stored: saved.stored };
    this.ctx.markDirty(true);
  }

  /** Вор забирает персонажа с места. Монеты на плите остаются игроку. */
  takeForThief(slot: number): Brainrot | null {
    const resident = this.residents[slot];
    if (!resident || resident.state !== 'seated') return null;
    this.residents[slot] = null;
    const saved = this.ctx.save.slots[slot];
    this.ctx.save.slots[slot] = { id: null, gold: false, stored: saved.stored };
    this.ctx.save.stats.lost++;
    resident.pickUp();
    this.ctx.markDirty(true);
    return resident;
  }

  /** Игрок отбил персонажа у вора — он возвращается на полок (или продаётся, если места уже нет). */
  recover(brainrot: Brainrot): void {
    this.ctx.save.stats.lost = Math.max(0, this.ctx.save.stats.lost - 1);
    if (this.deposit(brainrot)) return;
    const refund = sellValue(brainrot.def, brainrot.gold);
    this.ctx.save.coins += refund;
    this.ctx.labels.float(`+${formatNumber(refund)}`, brainrot.position.clone().setY(2), 'float-coins');
    this.ctx.removeBrainrot(brainrot);
    this.ctx.markDirty(true);
  }

  /** Перерождение: все уходят с полка (места и монеты на плитах сбросило сохранение). */
  clearShelf(): void {
    this.residents.forEach((resident, slot) => {
      if (!resident) return;
      this.ctx.labels.float('💨', resident.position.clone().setY(2), 'float-spend', 1200);
      this.ctx.removeBrainrot(resident);
      this.residents[slot] = null;
    });
    this.chatter.hide();
    this.chatterFrom = null;
  }

  /** Самый ценный персонаж, которого может утащить вор (−1 — красть нечего). */
  raidTarget(): number {
    return pickRaidTarget(this.ctx.save.slots, (i) => this.residents[i]?.state === 'seated');
  }

  platePosition(slot: number): THREE.Vector3 {
    return this.ctx.world.home.plates[slot];
  }

  /** Точка перед входом, ближайшая к x (внутри ширины проёма). */
  entranceNear(x: number): THREE.Vector3 {
    const layout = this.ctx.world.home;
    return layout.entrance.clone().setX(clamp(x, layout.interior.minX + 1, layout.interior.maxX - 1));
  }

  private lock(): void {
    this.lockedUntil = this.ctx.time + latchDuration(this.ctx.save.upgrades);
    this.ctx.audio.blip('unlock');
    this.ctx.hud.showBanner(t.home.latched, '#ff6b6b');
  }

  /** Путь до места: через вход (если снаружи), к плите, потом на полок. */
  private pathTo(slot: number, from: THREE.Vector3): THREE.Vector3[] {
    const layout = this.ctx.world.home;
    const plate = layout.plates[slot];
    const points: THREE.Vector3[] = [];
    if (!this.isInside(from)) points.push(this.entranceNear(from.x));
    points.push(new THREE.Vector3(plate.x, 0, plate.z + 0.6), layout.seats[slot]);
    return points;
  }

  private collect(slotIndex: number, amount: number): void {
    const { save } = this.ctx;
    save.slots[slotIndex].stored -= amount;
    save.coins += amount;
    save.stats.earned += amount;
    if (this.ctx.time - this.lastCollectText > 0.35) {
      this.lastCollectText = this.ctx.time;
      const plate = this.plates[slotIndex].mesh.position;
      this.ctx.labels.float(`+${formatNumber(amount)}`, plate.clone().setY(1.2), 'float-coins');
      this.ctx.fx.coins(plate.clone().setY(0.3), amount);
      this.ctx.audio.blip('coin');
    }
    this.ctx.tutorialEvent('collected');
    this.ctx.markDirty(true);
  }

  private unlockSlot(index: number, cost: number): void {
    const { save } = this.ctx;
    if (save.coins < cost || index !== save.unlocked) return;
    save.coins -= cost;
    save.unlocked++;
    this.ctx.audio.blip('unlock');
    this.ctx.hud.showBanner(t.home.newSlot, '#a7f070');
    this.ctx.markDirty(true);
  }
}
