import * as THREE from 'three';
import { formatNumber } from '@engine/format';
import type { Label } from '@engine/labels';
import { distanceXZ, type Box, type PointXZ } from '@engine/math';
import type { SpriteSheet } from '@engine/sprite';
import { BOT, NEIGHBORS, PLAYER, RAID, STEAL_RANGE } from './config';
import type { Action, GameContext } from './context';
import { CHARACTERS, characterById, type CharacterDef } from './data/characters';
import { RARITIES } from './data/rarity';
import { findSlotFor } from './economy';
import type { Obstacles } from './entities/actor';
import type { Brainrot } from './entities/brainrot';
import { Bot, type BotState } from './entities/bot';
import type { Home } from './home';
import { createNeighborRoster, neighborSlotFor, playerPower, rollNeighborCharacter } from './neighbors';
import { TUTORIAL_DONE } from './save';
import { speedMultiplier } from './upgrades';
import type { BanyaLayout } from './world';

/** Сосед занимает места со 2-го по 7-е — середину своей скамьи. */
const SEAT_OFFSET = 1;
/** Проходы между банями: через них боты обходят срубы сзади. */
const GAPS_X = [-36, -12, 12, 36];
/** Дворик перед банями — по нему удобно ходить от бани к бане. */
const YARD_Z = 2;
/** Сколько раз за игру подсказывать, что соседа можно шлёпнуть веником. */
const BROOM_HINTS = 2;

/** Хозяин дома и не спит — кражу заметит сразу. */
const AWAKE_AT_HOME: ReadonlySet<BotState> = new Set<BotState>(['idle', 'notice', 'guard', 'swing', 'alert']);
/** Сосед настроен враждебно — его стоит шлёпнуть веником. */
const HOSTILE: ReadonlySet<BotState> = new Set<BotState>(['notice', 'guard', 'alert', 'chase', 'swing', 'raidGo', 'raidWait', 'raidEnter', 'raidEscape']);
const RAIDING: ReadonlySet<BotState> = new Set<BotState>(['raidGo', 'raidWait', 'raidEnter', 'raidEscape']);

interface Neighbor {
  readonly name: string;
  readonly genitive: string;
  readonly layout: BanyaLayout;
  /** id персонажей по местам — та же ссылка, что в сохранении. */
  readonly slots: (string | null)[];
  readonly residents: (Brainrot | null)[];
  readonly bot: Bot;
  /** Табличка над входом, пока баня закрыта на щеколду. */
  readonly latchLabel: Label;
  refillTimer: number;
  /** Набег: какое место у игрока хотим украсть и кого уже несём. */
  raidSlot: number;
  raidLoot: Brainrot | null;
  /** Щеколда соседа: закрыта ли и сколько секунд до смены. */
  latched: boolean;
  latchTimer: number;
  /** Откуда замах веником: из погони или когда выгонял из бани. */
  swingFrom: 'guard' | 'chase';
  /** Когда началась погоня, секунды игры. */
  chaseStart: number;
  /** После оглушения — бежать домой (его прогнали из набега). */
  fleeing: boolean;
}

interface Loot {
  readonly brainrot: Brainrot;
  readonly from: Neighbor;
  readonly slot: number;
}

const inside = (box: Box, p: PointXZ, margin = 0) =>
  p.x >= box.minX - margin && p.x <= box.maxX + margin && p.z >= box.minZ - margin && p.z <= box.maxZ + margin;

/**
 * Соседи-боты: их бани и персонажи, кражи у них, охрана и погоня с веником,
 * щеколды соседей и их набеги на баню игрока.
 */
export class Neighborhood {
  readonly neighbors: Neighbor[];
  /** Кого несёт игрок. */
  carried: Loot | null = null;
  private readonly ctx: GameContext;
  private readonly home: Home;
  private raidTimer: number = RAID.firstDelay;
  private tutorialTheft: { neighbor: Neighbor; brainrot: Brainrot } | null = null;
  private broomHints = 0;

  constructor(ctx: GameContext, home: Home, botSheets: readonly SpriteSheet[], broomSheet: SpriteSheet) {
    this.ctx = ctx;
    this.home = home;
    const { save, rng } = ctx;
    if (save.neighbors.length !== NEIGHBORS.length) {
      const power = playerPower(save.slots);
      save.neighbors = NEIGHBORS.map(() => ({ slots: createNeighborRoster(rng, CHARACTERS, power, BOT.slots) }));
    }
    this.neighbors = NEIGHBORS.map((config, i) => {
      const layout = ctx.world.neighbors[i];
      const sign = ctx.labels.create('world-sign neighbor-sign');
      sign.element.textContent = `БАНЯ ${config.genitive.toUpperCase()}`;
      sign.anchor.copy(layout.signAnchor);
      const latchLabel = ctx.labels.create('plate-tag lock-tag');
      latchLabel.anchor.set(layout.centerX, 1.9, layout.interior.maxZ);
      latchLabel.visible = false;
      const bot = new Bot(botSheets[i], ctx.labels.create('bot-status'), broomSheet);
      bot.position.copy(this.homeSpot(layout));
      bot.setState('idle', rng.range(...BOT.awakeTime));
      ctx.scene.add(bot.root);
      const neighbor: Neighbor = {
        name: config.name,
        genitive: config.genitive,
        layout,
        slots: save.neighbors[i].slots,
        residents: [],
        bot,
        latchLabel,
        refillTimer: rng.range(...BOT.refillInterval),
        raidSlot: -1,
        raidLoot: null,
        latched: false,
        latchTimer: rng.range(...BOT.latchOpen),
        swingFrom: 'guard',
        chaseStart: 0,
        fleeing: false,
      };
      neighbor.slots.forEach((id, slot) => {
        const def = id ? characterById(id) : undefined;
        neighbor.residents[slot] = def ? this.seatResident(neighbor, slot, def) : null;
      });
      return neighbor;
    });
  }

  get isCarrying(): boolean {
    return this.carried !== null;
  }

  /** Во сколько раз медленнее бежит игрок (с добычей на руках — медленнее). */
  get speedFactor(): number {
    return this.carried ? PLAYER.carrySpeedFactor : 1;
  }

  update(dt: number): void {
    for (const n of this.neighbors) {
      n.residents.forEach((r, slot) => {
        if (!r) return;
        r.update(dt);
        // подписи соседних мест — на разной высоте, чтобы не налезали друг на друга
        r.label?.anchor.set(r.position.x, r.position.y + 1.9 + (slot % 2) * 0.45, r.position.z);
      });
      this.updateLatch(n, dt);
      this.updateRefill(n, dt);
      this.updateBot(n, dt);
    }
    this.updateCarried(dt);
    this.updateRaids(dt);
  }

  /** Препятствия для игрока: мир и закрытые щеколды соседей. Изнутри бани выйти можно всегда. */
  playerObstacles(): Obstacles {
    const { world, player } = this.ctx;
    const closed = this.neighbors.filter((n) => n.latched && !inside(n.layout.interior, player.position));
    if (closed.length === 0) return world;
    return { boxes: [...world.boxes, ...closed.map((n) => n.layout.latchBox)], circles: world.circles, bounds: world.bounds };
  }

  /** Ближайший враждебный сосед в радиусе range — чтобы подсказать «Шлёпнуть веником». */
  hostileNear(center: PointXZ, range: number): { readonly name: string } | null {
    let best: Neighbor | null = null;
    let bestDistance = range;
    for (const n of this.neighbors) {
      if (!HOSTILE.has(n.bot.state)) continue;
      const distance = distanceXZ(n.bot.position, center);
      if (distance <= bestDistance) {
        best = n;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Удар веника игрока: оглушает соседей в радиусе range на stun секунд. Возвращает, скольких задел. */
  hitAround(center: PointXZ, range: number, stun: number): number {
    let hits = 0;
    for (const n of this.neighbors) {
      if (distanceXZ(n.bot.position, center) > range) continue;
      this.onBroomHit(n, center, stun);
      hits++;
    }
    return hits;
  }

  /** Украсть ближайшего персонажа с полка соседа. */
  findAction(): Action | null {
    if (this.carried || this.ctx.player.isStunned) return null;
    let best: { n: Neighbor; slot: number; r: Brainrot } | null = null;
    let bestDistance = STEAL_RANGE;
    for (const n of this.neighbors) {
      for (let slot = 0; slot < n.residents.length; slot++) {
        const r = n.residents[slot];
        if (!r || r.state !== 'seated') continue;
        const distance = distanceXZ(this.ctx.player.position, r.position);
        if (distance < bestDistance) {
          best = { n, slot, r };
          bestDistance = distance;
        }
      }
    }
    if (!best) return null;
    const { n, slot, r } = best;
    const room = findSlotFor(this.ctx.save, r.def) !== null;
    const state = n.bot.state;
    const detail = !room
      ? 'нет места в бане — открой новое'
      : state === 'sleeping'
        ? `${n.name} спит — тихо!`
        : state === 'stunned'
          ? `${n.name} оглушён — хватай и беги!`
          : AWAKE_AT_HOME.has(state)
            ? `${n.name} заметит — беги домой!`
            : `${n.name} не дома — давай!`;
    return { view: { title: `Украсть «${r.def.name}»`, detail, enabled: room }, run: () => this.steal(n, slot) };
  }

  /**
   * Для обучения: лучший персонаж у ближайшего соседа. Хозяин спит, а щеколда открыта,
   * чтобы первая кража точно получилась.
   */
  tutorialTarget(): Brainrot | null {
    const current = this.tutorialTheft;
    if (current?.brainrot.state === 'seated' && current.neighbor.residents.includes(current.brainrot)) {
      this.keepTutorialEasy(current.neighbor);
      return current.brainrot;
    }
    const player = this.ctx.player.position;
    const n = this.neighbors.reduce((a, b) => (Math.abs(a.layout.centerX - player.x) < Math.abs(b.layout.centerX - player.x) ? a : b));
    const target = n.residents
      .filter((r): r is Brainrot => r?.state === 'seated')
      .reduce<Brainrot | null>((a, b) => (!a || b.def.income > a.def.income ? b : a), null);
    if (!target) return null;
    this.tutorialTheft = { neighbor: n, brainrot: target };
    this.keepTutorialEasy(n);
    return target;
  }

  private keepTutorialEasy(n: Neighbor): void {
    const state = n.bot.state;
    // спит с запасом: даже с дальнего места игрок успеет донести добычу
    if (state === 'idle' || state === 'notice' || state === 'guard' || (state === 'sleeping' && n.bot.timer < 15)) n.bot.setState('sleeping', 40);
    if (n.latched) {
      n.latched = false;
      n.latchTimer = 40;
    }
  }

  // ---------------------------------------------------------------- кража игроком

  private steal(n: Neighbor, slot: number): void {
    const r = n.residents[slot];
    if (!r || r.state !== 'seated') return;
    n.residents[slot] = null;
    n.slots[slot] = null;
    r.label?.remove();
    r.label = null;
    r.pickUp();
    this.carried = { brainrot: r, from: n, slot };
    this.ctx.playVoice(r.def);
    this.ctx.audio.blip('buy');
    const state = n.bot.state;
    if (AWAKE_AT_HOME.has(state)) {
      n.bot.setState('alert');
      this.ctx.audio.blip('alarm');
      this.ctx.hud.showBanner(`${n.name} заметил! Беги в свою баню!`, '#ff6b6b');
    } else if (state === 'stunned') {
      this.ctx.hud.showBanner(`${n.name} сейчас очнётся — беги в свою баню!`, '#ffcd75');
    } else {
      this.ctx.hud.showBanner('Неси в свою баню!', '#a7f070');
    }
    this.ctx.markDirty(true);
  }

  private updateCarried(dt: number): void {
    const loot = this.carried;
    if (!loot) return;
    const p = this.ctx.player.position;
    loot.brainrot.position.set(p.x, 1.25, p.z);
    loot.brainrot.update(dt);
    if (!this.home.isInside(p)) return;
    if (!this.home.deposit(loot.brainrot)) {
      this.ctx.hud.showBanner('Нет места на полке — открой новое место', '#ff6b6b');
      return;
    }
    this.carried = null;
    this.ctx.save.stats.stolen++;
    this.ctx.audio.blip('unlock');
    this.ctx.hud.showBanner(`Украл «${loot.brainrot.def.name}»! +${formatNumber(loot.brainrot.def.income)}/с`, '#a7f070');
    const state = loot.from.bot.state;
    if (state === 'alert' || state === 'chase' || state === 'swing') this.sendHome(loot.from, '😤');
    this.ctx.tutorialEvent('stolen');
  }

  /** Сосед огрел игрока с добычей: добыча возвращается хозяину, игрок оглушён. */
  private catchPlayer(n: Neighbor): void {
    const loot = this.carried;
    if (!loot) return;
    this.carried = null;
    this.ctx.player.stun(PLAYER.stunTime);
    this.ctx.audio.blip('caught');
    this.ctx.hud.showBanner(`${n.name} огрел тебя веником! «${loot.brainrot.def.name}» вернулся на место`, '#ff6b6b');
    this.returnToNeighbor(loot.from, loot.brainrot, loot.slot);
    this.sendHome(n, '😏');
    const owner = loot.from.bot.state;
    if (loot.from !== n && (owner === 'alert' || owner === 'chase' || owner === 'swing')) this.sendHome(loot.from, '😏');
  }

  // ---------------------------------------------------------------- веник

  private onBroomHit(n: Neighbor, from: PointXZ, stun: number): void {
    const { bot } = n;
    const raiding = RAIDING.has(bot.state);
    const loot = n.raidLoot;
    n.raidLoot = null;
    n.fleeing = raiding;
    if (raiding) n.raidSlot = -1;
    bot.setState('stunned', stun);
    bot.knock(bot.position.x - from.x, bot.position.z - from.z, 0.9);
    this.ctx.labels.float('Шлёп!', bot.position.clone().setY(2.2), 'float-hit', 800);
    this.ctx.audio.blip('whack');
    if (loot) {
      this.home.recover(loot);
      this.ctx.audio.blip('unlock');
      this.ctx.hud.showBanner(`Ты отбил «${loot.def.name}»!`, '#a7f070');
    } else if (raiding) {
      this.ctx.hud.showBanner(`Ты прогнал ${n.genitive}!`, '#a7f070');
    }
  }

  /** Сосед очнулся после удара веником. */
  private afterStun(n: Neighbor): void {
    const fleeing = n.fleeing;
    n.fleeing = false;
    if (this.carried?.from === n) this.startChase(n);
    else if (!fleeing && this.intruderIn(n)) n.bot.setState('guard');
    else this.sendHome(n, fleeing ? '😣' : '😤');
  }

  /** Замах веником закончился — удар. */
  private strike(n: Neighbor): void {
    const { bot } = n;
    const { player } = this.ctx;
    bot.swingAt(player.position);
    this.ctx.audio.blip('swing');
    if (player.isStunned || distanceXZ(bot.position, player.position) > BOT.swingReach) {
      // промахнулся — снова за игроком
      bot.setState(n.swingFrom);
      return;
    }
    player.knock(player.position.x - bot.position.x, player.position.z - bot.position.z, PLAYER.knockback);
    this.ctx.labels.float('Шлёп!', player.position.clone().setY(2), 'float-hit', 800);
    this.ctx.audio.blip('whack');
    if (this.carried) {
      this.catchPlayer(n);
      return;
    }
    player.stun(BOT.hitStun);
    this.ctx.hud.showBanner(`${n.name} выгоняет тебя веником!`, '#ff6b6b');
    bot.setState('guard', 0.6); // постоит, потом снова выгонять
  }

  // ---------------------------------------------------------------- набеги на игрока

  private updateRaids(dt: number): void {
    const ready = this.home.seatedCount >= RAID.minResidents && (this.ctx.save.tutorial >= TUTORIAL_DONE || this.ctx.time > 300);
    if (!ready) return;
    this.raidTimer -= dt;
    if (this.raidTimer > 0) return;
    const candidates = this.neighbors.filter((n) => n.bot.state === 'idle' && !this.intruderIn(n));
    const target = this.home.raidTarget();
    if (candidates.length === 0 || target < 0) {
      this.raidTimer = 10;
      return;
    }
    this.startRaid(candidates[this.ctx.rng.int(0, candidates.length)], target);
    this.raidTimer = this.ctx.rng.range(...RAID.interval);
  }

  private startRaid(n: Neighbor, slot: number): void {
    if (slot < 0) return;
    n.raidSlot = slot;
    n.bot.setState('raidGo');
    const plate = this.home.platePosition(slot);
    n.bot.setPath([...this.pathOut(n, n.bot.position), this.home.entranceNear(plate.x)]);
    const def = characterById(this.ctx.save.slots[slot].id ?? '');
    this.ctx.audio.blip('alarm');
    this.ctx.hud.showBanner(`${n.name} идёт красть${def ? ` «${def.name}»` : ''}! Закрой баню или встреть его веником`, '#ff6b6b', 4000);
  }

  private enterHome(n: Neighbor): void {
    const plate = this.home.platePosition(n.raidSlot);
    n.bot.setState('raidEnter');
    n.bot.setPath([new THREE.Vector3(plate.x, 0, plate.z + 0.5)]);
  }

  private grab(n: Neighbor): void {
    const loot = this.home.takeForThief(n.raidSlot);
    if (!loot) {
      this.sendHome(n, '🤷');
      return;
    }
    n.raidLoot = loot;
    n.bot.setState('raidEscape');
    n.bot.setPath([this.home.entranceNear(n.bot.position.x), n.layout.entrance.clone(), this.plateFront(n, BOT.slots >> 1)]);
    this.ctx.audio.blip('alarm');
    this.ctx.hud.showBanner(`${n.name} украл «${loot.def.name}»! Догони и шлёпни его!`, '#ff6b6b');
  }

  private stashLoot(n: Neighbor): void {
    const loot = n.raidLoot;
    n.raidLoot = null;
    n.bot.setState('idle', this.ctx.rng.range(...BOT.awakeTime));
    if (!loot) return;
    this.returnToNeighbor(n, loot, neighborSlotFor(n.slots, loot.def));
    this.ctx.hud.showBanner(`«${loot.def.name}» теперь у ${n.genitive} — укради обратно!`, '#ffcd75');
  }

  // ---------------------------------------------------------------- поведение бота

  private updateBot(n: Neighbor, dt: number): void {
    const { bot } = n;
    const { player, rng, world } = this.ctx;
    switch (bot.state) {
      case 'idle':
        bot.setStatus('');
        if (this.intruderIn(n) && inside(n.layout.interior, bot.position, 2)) {
          this.notice(n);
          break;
        }
        if (bot.pathDone && rng.chance(dt * 0.5)) bot.setPath([this.randomSpotInside(n.layout)]);
        bot.walkPath(dt, BOT.wanderSpeed);
        bot.timer -= dt;
        if (bot.timer <= 0) bot.setState('sleeping', rng.range(...BOT.sleepTime));
        break;
      case 'sleeping':
        bot.setStatus('💤');
        bot.timer -= dt;
        if (bot.timer <= 0) this.wakeUp(n);
        break;
      case 'notice':
        bot.setStatus('❗');
        if (bot.stateTime >= BOT.noticeTime) this.decide(n);
        break;
      case 'guard':
        bot.setStatus('😠');
        if (this.carried?.from === n) this.startChase(n);
        else if (!this.intruderIn(n, 1)) this.calmDown(n);
        else if (bot.timer > 0) bot.timer -= dt;
        else if (!player.isStunned) {
          bot.runTowards(player.position, BOT.guardSpeed, dt, world);
          if (distanceXZ(bot.position, player.position) < BOT.swingStart) this.windUp(n, 'guard');
        }
        break;
      case 'alert':
        bot.setStatus('❗');
        if (bot.stateTime >= BOT.alertTime) this.startChase(n);
        break;
      case 'chase':
        bot.setStatus('😠');
        if (this.carried?.from !== n || this.ctx.time - n.chaseStart > BOT.chaseTimeout) {
          this.sendHome(n, '😤');
          break;
        }
        bot.runTowards(player.position, this.chaseSpeed, dt, world);
        if (distanceXZ(bot.position, player.position) < BOT.swingStart) this.windUp(n, 'chase');
        break;
      case 'swing':
        bot.setStatus('🧹');
        if (n.swingFrom === 'chase' && this.carried?.from !== n) {
          this.sendHome(n, '😤');
          break;
        }
        // замахнулся и продолжает бежать — от удара не уйти, если не успел раньше
        bot.runTowards(player.position, n.swingFrom === 'chase' ? this.chaseSpeed : BOT.guardSpeed, dt, world);
        if (bot.stateTime >= BOT.swingWindup) this.strike(n);
        break;
      case 'returning':
        if (bot.walkPath(dt, BOT.walkSpeed)) bot.setState('idle', rng.range(...BOT.awakeTime));
        break;
      case 'raidGo':
        bot.setStatus('🥷');
        if (bot.walkPath(dt, BOT.walkSpeed)) {
          if (this.home.locked) bot.setState('raidWait');
          else this.enterHome(n);
        }
        break;
      case 'raidWait':
        bot.setStatus('⏳');
        if (!this.home.locked) this.enterHome(n);
        else if (bot.stateTime > RAID.waitAtLock) this.sendHome(n, '😤');
        break;
      case 'raidEnter':
        bot.setStatus('🥷');
        if (bot.walkPath(dt, BOT.walkSpeed)) this.grab(n);
        break;
      case 'raidEscape': {
        bot.setStatus('💨');
        const loot = n.raidLoot;
        if (!loot) {
          this.sendHome(n, '');
          break;
        }
        loot.position.set(bot.position.x, 1.25, bot.position.z);
        loot.update(dt);
        if (bot.walkPath(dt, BOT.escapeSpeed)) this.stashLoot(n);
        break;
      }
      case 'stunned':
        bot.setStatus('💫');
        bot.timer -= dt;
        if (bot.timer <= 0) this.afterStun(n);
        break;
    }
    bot.animate(dt, world);
  }

  /** Скорость погони: чуть быстрее игрока с добычей, с учётом его кроссовок. */
  private get chaseSpeed(): number {
    return PLAYER.speed * speedMultiplier(this.ctx.save.upgrades) * PLAYER.carrySpeedFactor + BOT.chaseEdge;
  }

  /** Игрок у соседа в бане (margin — насколько можно отойти за порог). */
  private intruderIn(n: Neighbor, margin = 0): boolean {
    return inside(n.layout.interior, this.ctx.player.position, margin);
  }

  private notice(n: Neighbor): void {
    n.bot.setState('notice');
    const hint = this.broomHints < BROOM_HINTS;
    if (hint) this.broomHints++;
    this.ctx.hud.showBanner(`${n.name} тебя заметил!${hint ? ' Шлёпни его веником — или беги' : ''}`, '#ff6b6b', hint ? 3500 : 2000);
  }

  /** Решение после «❗»: гнаться за вором, выгонять из бани или успокоиться. */
  private decide(n: Neighbor): void {
    if (this.carried?.from === n) this.startChase(n);
    else if (this.intruderIn(n)) n.bot.setState('guard');
    else this.calmDown(n);
  }

  private wakeUp(n: Neighbor): void {
    if (this.carried?.from === n) {
      n.bot.setState('alert');
      this.ctx.audio.blip('alarm');
      this.ctx.hud.showBanner(`${n.name} проснулся и заметил пропажу! Беги!`, '#ff6b6b');
    } else if (this.intruderIn(n)) {
      this.notice(n);
    } else {
      n.bot.setState('idle', this.ctx.rng.range(...BOT.awakeTime));
    }
  }

  private calmDown(n: Neighbor): void {
    n.bot.setState('idle', this.ctx.rng.range(...BOT.awakeTime));
    n.bot.setPath([this.randomSpotInside(n.layout)]);
  }

  private startChase(n: Neighbor): void {
    n.chaseStart = this.ctx.time;
    n.bot.setState('chase');
  }

  private windUp(n: Neighbor, from: 'guard' | 'chase'): void {
    n.swingFrom = from;
    n.bot.setState('swing');
  }

  private sendHome(n: Neighbor, status: string): void {
    n.raidSlot = -1;
    n.bot.setState('returning');
    n.bot.setStatus(status);
    const from = n.bot.position;
    const entrance = inside(n.layout.interior, from) ? [] : [n.layout.entrance.clone()];
    n.bot.setPath([...this.pathOut(n, from, false), ...entrance, this.homeSpot(n.layout)]);
  }

  // ---------------------------------------------------------------- щеколда и полок соседа

  private updateLatch(n: Neighbor, dt: number): void {
    n.latchTimer -= dt;
    if (n.latchTimer <= 0) {
      n.latched = !n.latched;
      const [min, max] = n.latched ? BOT.latchClosed : BOT.latchOpen;
      n.latchTimer = this.ctx.rng.range(min, max);
    }
    n.layout.barrier.visible = n.latched;
    n.latchLabel.visible = n.latched;
    if (!n.latched) return;
    const text = `🔒 ${Math.ceil(n.latchTimer)} с`;
    if (n.latchLabel.element.textContent !== text) n.latchLabel.element.textContent = text;
  }

  private updateRefill(n: Neighbor, dt: number): void {
    n.refillTimer -= dt;
    if (n.refillTimer > 0) return;
    const { rng, save } = this.ctx;
    n.refillTimer = rng.range(...BOT.refillInterval);
    const def = rollNeighborCharacter(rng, CHARACTERS, playerPower(save.slots));
    let slot = n.slots.findIndex((id, i) => id === null && !n.residents[i]);
    if (slot < 0 && rng.chance(0.35)) slot = neighborSlotFor(n.slots, def);
    if (slot < 0) return;
    const old = n.residents[slot];
    if (old) this.ctx.removeBrainrot(old);
    n.slots[slot] = def.id;
    n.residents[slot] = this.seatResident(n, slot, def);
    this.ctx.markDirty();
  }

  /** Персонаж возвращается на полок соседа своими ногами (после погони или набега). */
  private returnToNeighbor(n: Neighbor, brainrot: Brainrot, preferredSlot: number): void {
    let slot = preferredSlot >= 0 && n.slots[preferredSlot] === null && !n.residents[preferredSlot] ? preferredSlot : neighborSlotFor(n.slots, brainrot.def);
    if (slot < 0) slot = this.weakestSlot(n);
    const old = n.residents[slot];
    if (old) this.ctx.removeBrainrot(old);
    n.slots[slot] = brainrot.def.id;
    n.residents[slot] = brainrot;
    this.attachLabel(brainrot);
    const from = brainrot.position;
    brainrot.sendTo(slot, [...this.pathOut(n, from, false), ...(inside(n.layout.interior, from) ? [] : [n.layout.entrance.clone()]), this.plateFront(n, slot), this.seat(n, slot)]);
    this.ctx.markDirty(true);
  }

  private weakestSlot(n: Neighbor): number {
    let weakest = 0;
    let income = Infinity;
    n.slots.forEach((id, i) => {
      const value = id ? (characterById(id)?.income ?? 0) : -1;
      if (value < income) {
        income = value;
        weakest = i;
      }
    });
    return weakest;
  }

  private seatResident(n: Neighbor, slot: number, def: CharacterDef): Brainrot {
    const brainrot = this.ctx.createBrainrot(def);
    brainrot.seatAt(slot, this.seat(n, slot));
    this.attachLabel(brainrot);
    return brainrot;
  }

  private attachLabel(brainrot: Brainrot): void {
    brainrot.label?.remove();
    const label = this.ctx.labels.create('resident-tag');
    label.element.textContent = brainrot.def.name;
    label.element.style.color = RARITIES[brainrot.def.rarity].color;
    brainrot.label = label;
  }

  // ---------------------------------------------------------------- маршруты

  private seat(n: Neighbor, slot: number): THREE.Vector3 {
    return n.layout.seats[slot + SEAT_OFFSET];
  }

  private plateFront(n: Neighbor, slot: number): THREE.Vector3 {
    const plate = n.layout.plates[slot + SEAT_OFFSET];
    return new THREE.Vector3(plate.x, 0, plate.z + 0.5);
  }

  private homeSpot(layout: BanyaLayout): THREE.Vector3 {
    return new THREE.Vector3(layout.centerX, 0, -2);
  }

  private randomSpotInside(layout: BanyaLayout): THREE.Vector3 {
    return new THREE.Vector3(layout.centerX + this.ctx.rng.range(-5.5, 5.5), 0, this.ctx.rng.range(-4, 0));
  }

  /**
   * Как выйти во дворик перед банями из любой точки: из бани игрока — через её вход,
   * из-за срубов — через ближайший проход. includeOwn — выходить ли из своей бани.
   */
  private pathOut(n: Neighbor, from: THREE.Vector3, includeOwn = true): THREE.Vector3[] {
    if (this.home.isInside(from)) return [this.home.entranceNear(from.x)];
    for (const other of this.neighbors) {
      if (!inside(other.layout.interior, from)) continue;
      return other === n && !includeOwn ? [] : [other.layout.entrance.clone()];
    }
    if (from.z >= YARD_Z - 0.5) return [];
    const gap = GAPS_X.reduce((a, b) => (Math.abs(b - from.x) < Math.abs(a - from.x) ? b : a));
    return [new THREE.Vector3(gap, 0, from.z), new THREE.Vector3(gap, 0, YARD_Z)];
  }
}
