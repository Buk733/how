import * as THREE from 'three';
import { formatNumber } from '@engine/format';
import type { Label } from '@engine/labels';
import { distanceXZ, insideBox, segmentHitsBox, type Box, type PointXZ } from '@engine/math';
import { NavGrid } from '@engine/pathfinding';
import type { SpriteSheet } from '@engine/sprite';
import { GOLD_COLOR } from './carpet';
import { BOT, GOLD, NEIGHBORS, PLAYER, RAID, STEAL_RANGE } from './config';
import type { Action, GameContext } from './context';
import { CHARACTERS, characterById, type CharacterDef } from './data/characters';
import { RARITIES } from './data/rarity';
import { findSlotFor, unitIncome, unitName } from './economy';
import type { Obstacles } from './entities/actor';
import type { Brainrot } from './entities/brainrot';
import { Bot, type BotState } from './entities/bot';
import type { Home } from './home';
import { createNeighborRoster, neighborSlotFor, neighborUnitIncome, playerPower, rollNeighborCharacter } from './neighbors';
import { TUTORIAL_DONE, type UnitSave } from './save';
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
/** Как часто бот в погоне заново ищет путь в обход стен, секунды. */
const REPATH_INTERVAL = 0.35;
/** Насколько за порог своей бани хозяин выгоняет игрока. */
const GUARD_PORCH = 1.5;

/** Хозяин дома и не спит — кражу заметит сразу. */
const AWAKE_AT_HOME: ReadonlySet<BotState> = new Set<BotState>(['idle', 'notice', 'guard', 'swing', 'alert']);
/** Сосед настроен враждебно — его стоит шлёпнуть веником. */
const HOSTILE: ReadonlySet<BotState> = new Set<BotState>(['notice', 'guard', 'alert', 'chase', 'swing', 'raidGo', 'raidWait', 'raidEnter', 'raidEscape']);
const RAIDING: ReadonlySet<BotState> = new Set<BotState>(['raidGo', 'raidWait', 'raidEnter', 'raidEscape']);

interface Neighbor {
  readonly name: string;
  readonly genitive: string;
  readonly layout: BanyaLayout;
  /** Персонажи по местам — та же ссылка, что в сохранении. */
  readonly slots: (UnitSave | null)[];
  readonly residents: (Brainrot | null)[];
  readonly bot: Bot;
  /** Табличка над входом, пока баня закрыта на щеколду. */
  readonly latchLabel: Label;
  /** Где хозяин выгоняет игрока: баня и немного перед входом. */
  readonly guardZone: Box;
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
  /** Путь в обход стен к игроку и когда его пересчитать. */
  route: PointXZ[] | null;
  repath: number;
}

interface Loot {
  readonly brainrot: Brainrot;
  readonly from: Neighbor;
  readonly slot: number;
}

/**
 * Соседи-боты: их бани и персонажи, кражи у них, охрана и погоня с веником,
 * щеколды соседей и их набеги на баню игрока.
 */
export class Neighborhood {
  readonly neighbors: Neighbor[];
  /** Кого несёт игрок. */
  carried: Loot | null = null;
  /** Пока открыто окно (кейсы, колесо…), новые набеги не начинаются. */
  raidsPaused = false;
  private readonly ctx: GameContext;
  private readonly home: Home;
  /** Карта проходимости: по ней боты обходят срубы. */
  private readonly nav: NavGrid;
  private raidTimer: number = RAID.firstDelay;
  private tutorialTheft: { neighbor: Neighbor; brainrot: Brainrot } | null = null;
  private broomHints = 0;

  constructor(ctx: GameContext, home: Home, botSheets: readonly SpriteSheet[], broomSheet: SpriteSheet) {
    this.ctx = ctx;
    this.home = home;
    this.nav = new NavGrid(ctx.world, 0.3, 0.5);
    const { save, rng } = ctx;
    if (save.neighbors.length !== NEIGHBORS.length) {
      const power = playerPower(save.slots);
      save.neighbors = NEIGHBORS.map(() => ({ slots: createNeighborRoster(rng, CHARACTERS, power, BOT.slots, GOLD.neighborChance) }));
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
        guardZone: { ...layout.interior, maxZ: layout.interior.maxZ + GUARD_PORCH },
        refillTimer: rng.range(...BOT.refillInterval),
        raidSlot: -1,
        raidLoot: null,
        latched: false,
        latchTimer: rng.range(...BOT.latchOpen),
        swingFrom: 'guard',
        chaseStart: 0,
        fleeing: false,
        route: null,
        repath: 0,
      };
      neighbor.slots.forEach((unit, slot) => {
        const def = unit ? characterById(unit.id) : undefined;
        neighbor.residents[slot] = def && unit ? this.seatResident(neighbor, slot, def, unit.gold) : null;
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
    const closed = this.neighbors.filter((n) => n.latched && !insideBox(player.position, n.layout.interior));
    if (closed.length === 0) return world;
    return { boxes: [...world.boxes, ...closed.map((n) => n.layout.latchBox)], circles: world.circles, bounds: world.bounds };
  }

  /** Ближайший враждебный сосед в радиусе range, до которого не мешает стена. */
  hostileNear(center: PointXZ, range: number): { readonly name: string } | null {
    let best: Neighbor | null = null;
    let bestDistance = range;
    for (const n of this.neighbors) {
      if (!HOSTILE.has(n.bot.state) || !this.clearShot(center, n.bot.position)) continue;
      const distance = distanceXZ(n.bot.position, center);
      if (distance <= bestDistance) {
        best = n;
        bestDistance = distance;
      }
    }
    return best;
  }

  /** Удар веника игрока: оглушает соседей в радиусе range (не через стену). Возвращает, скольких задел. */
  hitAround(center: PointXZ, range: number, stun: number): number {
    let hits = 0;
    for (const n of this.neighbors) {
      if (distanceXZ(n.bot.position, center) > range || !this.clearShot(center, n.bot.position)) continue;
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
    const room = findSlotFor(this.ctx.save, r.def, r.gold) !== null;
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
    return { view: { title: `Украсть «${unitName(r.def, r.gold)}»`, detail, enabled: room }, run: () => this.steal(n, slot) };
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
      .reduce<Brainrot | null>((a, b) => (!a || unitIncome(b.def, b.gold) > unitIncome(a.def, a.gold) ? b : a), null);
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
    this.ctx.audio.blip(r.gold ? 'gold' : 'buy');
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
    const { def, gold } = loot.brainrot;
    this.ctx.hud.showBanner(`Украл «${unitName(def, gold)}»! +${formatNumber(unitIncome(def, gold))}/с`, gold ? GOLD_COLOR : '#a7f070');
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
    this.ctx.hud.showBanner(`${n.name} огрел тебя веником! «${unitName(loot.brainrot.def, loot.brainrot.gold)}» вернулся на место`, '#ff6b6b');
    this.returnToNeighbor(loot.from, loot.brainrot, loot.slot);
    this.sendHome(n, '😏');
    const owner = loot.from.bot.state;
    if (loot.from !== n && (owner === 'alert' || owner === 'chase' || owner === 'swing')) this.sendHome(loot.from, '😏');
  }

  // ---------------------------------------------------------------- веник

  /** Нет ли стены между точками (веник и замах через стену не бьют). */
  private clearShot(a: PointXZ, b: PointXZ): boolean {
    return !this.ctx.world.boxes.some((box) => segmentHitsBox(a, b, box));
  }

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
      this.ctx.hud.showBanner(`Ты отбил «${unitName(loot.def, loot.gold)}»!`, '#a7f070');
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
    const reached = distanceXZ(bot.position, player.position) <= BOT.swingReach && this.clearShot(bot.position, player.position);
    if (player.isStunned || !reached) {
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
    if (!ready || this.raidsPaused) return;
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

  /** Сосед тихо идёт красть: объявление будет, только когда он действительно что-то утащит. */
  private startRaid(n: Neighbor, slot: number): void {
    if (slot < 0) return;
    n.raidSlot = slot;
    n.bot.setState('raidGo');
    const plate = this.home.platePosition(slot);
    n.bot.setPath([...this.pathOut(n, n.bot.position), this.home.entranceNear(plate.x)]);
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
    this.ctx.hud.showBanner(`${n.name} украл у тебя «${unitName(loot.def, loot.gold)}»! Догони и шлёпни его!`, '#ff6b6b', 3500);
  }

  private stashLoot(n: Neighbor): void {
    const loot = n.raidLoot;
    n.raidLoot = null;
    n.bot.setState('idle', this.ctx.rng.range(...BOT.awakeTime));
    if (!loot) return;
    this.returnToNeighbor(n, loot, neighborSlotFor(n.slots, loot.def, loot.gold));
    this.ctx.hud.showBanner(`«${unitName(loot.def, loot.gold)}» теперь у ${n.genitive} — укради обратно!`, '#ffcd75');
  }

  // ---------------------------------------------------------------- поведение бота

  private updateBot(n: Neighbor, dt: number): void {
    const { bot } = n;
    const { player, rng, world } = this.ctx;
    switch (bot.state) {
      case 'idle':
        bot.setStatus('');
        if (this.intruderIn(n) && insideBox(bot.position, n.layout.interior, 2)) {
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
        else if (!insideBox(player.position, n.guardZone)) this.calmDown(n);
        else if (bot.timer > 0) bot.timer -= dt;
        else if (!player.isStunned) {
          this.pursue(n, BOT.guardSpeed, dt);
          if (this.canSwing(n)) this.windUp(n, 'guard');
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
        this.pursue(n, this.chaseSpeed, dt);
        if (this.canSwing(n)) this.windUp(n, 'chase');
        break;
      case 'swing':
        bot.setStatus('🧹');
        if (n.swingFrom === 'chase' && this.carried?.from !== n) {
          this.sendHome(n, '😤');
          break;
        }
        // замахнулся и продолжает бежать — от удара не уйти, если не успел раньше
        this.pursue(n, n.swingFrom === 'chase' ? this.chaseSpeed : BOT.guardSpeed, dt);
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
    // вор в набеге виден всегда: если он за краем экрана, значок прижат к краю
    bot.label.pinToEdge = RAIDING.has(bot.state);
    bot.animate(dt, world);
  }

  /** Бежит к игроку: напрямую, если по прямой свободно, иначе по пути в обход стен. */
  private pursue(n: Neighbor, speed: number, dt: number): void {
    const { bot } = n;
    const { player, world } = this.ctx;
    if (this.nav.clear(bot.position, player.position)) {
      n.route = null;
      bot.runTowards(player.position, speed, dt, world);
      return;
    }
    n.repath -= dt;
    if (!n.route || n.repath <= 0) {
      n.route = this.nav.findPath(bot.position, player.position);
      n.repath = REPATH_INTERVAL;
    }
    while (n.route && n.route.length > 1 && distanceXZ(bot.position, n.route[0]) < 0.35) n.route.shift();
    const next = n.route?.[0];
    if (next && n.route && n.route.length > 1) bot.runTowards(next, speed, dt, world, 0);
    else bot.runTowards(player.position, speed, dt, world);
  }

  /** Пора замахиваться: игрок рядом и между ними нет стены. */
  private canSwing(n: Neighbor): boolean {
    const { player } = this.ctx;
    return distanceXZ(n.bot.position, player.position) < BOT.swingStart && this.clearShot(n.bot.position, player.position);
  }

  /** Скорость погони: чуть быстрее игрока с добычей, с учётом его кроссовок. */
  private get chaseSpeed(): number {
    return PLAYER.speed * speedMultiplier(this.ctx.save.upgrades) * PLAYER.carrySpeedFactor + BOT.chaseEdge;
  }

  /** Игрок у соседа в бане. */
  private intruderIn(n: Neighbor): boolean {
    return insideBox(this.ctx.player.position, n.layout.interior);
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

  /** Игрок ушёл — хозяин возвращается в баню своей дорогой (в обход стен). */
  private calmDown(n: Neighbor): void {
    const spot = this.randomSpotInside(n.layout);
    const path = this.nav.findPath(n.bot.position, spot) ?? [spot];
    n.bot.setState('idle', this.ctx.rng.range(...BOT.awakeTime));
    n.bot.setPath(path.map((p) => new THREE.Vector3(p.x, 0, p.z)));
  }

  private startChase(n: Neighbor): void {
    n.chaseStart = this.ctx.time;
    n.route = null;
    n.bot.setState('chase');
  }

  private windUp(n: Neighbor, from: 'guard' | 'chase'): void {
    n.swingFrom = from;
    n.bot.setState('swing');
  }

  /** Сосед идёт домой по пути в обход стен. */
  private sendHome(n: Neighbor, status: string): void {
    n.raidSlot = -1;
    n.route = null;
    n.bot.setState('returning');
    n.bot.setStatus(status);
    const home = this.homeSpot(n.layout);
    const path = this.nav.findPath(n.bot.position, home) ?? [home];
    n.bot.setPath(path.map((p) => new THREE.Vector3(p.x, 0, p.z)));
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
    const gold = rng.chance(GOLD.neighborChance);
    let slot = n.slots.findIndex((unit, i) => unit === null && !n.residents[i]);
    if (slot < 0 && rng.chance(0.35)) slot = neighborSlotFor(n.slots, def, gold);
    if (slot < 0) return;
    const old = n.residents[slot];
    if (old) this.ctx.removeBrainrot(old);
    n.slots[slot] = { id: def.id, gold };
    n.residents[slot] = this.seatResident(n, slot, def, gold);
    this.ctx.markDirty();
  }

  /** Персонаж возвращается на полок соседа своими ногами (после погони или набега). */
  private returnToNeighbor(n: Neighbor, brainrot: Brainrot, preferredSlot: number): void {
    let slot =
      preferredSlot >= 0 && n.slots[preferredSlot] === null && !n.residents[preferredSlot]
        ? preferredSlot
        : neighborSlotFor(n.slots, brainrot.def, brainrot.gold);
    if (slot < 0) slot = this.weakestSlot(n);
    const old = n.residents[slot];
    if (old) this.ctx.removeBrainrot(old);
    n.slots[slot] = { id: brainrot.def.id, gold: brainrot.gold };
    n.residents[slot] = brainrot;
    this.attachLabel(brainrot);
    const from = brainrot.position;
    brainrot.sendTo(slot, [
      ...this.pathOut(n, from, false),
      ...(insideBox(from, n.layout.interior) ? [] : [n.layout.entrance.clone()]),
      this.plateFront(n, slot),
      this.seat(n, slot),
    ]);
    this.ctx.markDirty(true);
  }

  private weakestSlot(n: Neighbor): number {
    let weakest = 0;
    let income = Infinity;
    n.slots.forEach((unit, i) => {
      const value = unit ? neighborUnitIncome(unit) : -1;
      if (value < income) {
        income = value;
        weakest = i;
      }
    });
    return weakest;
  }

  private seatResident(n: Neighbor, slot: number, def: CharacterDef, gold: boolean): Brainrot {
    const brainrot = this.ctx.createBrainrot(def, gold);
    brainrot.seatAt(slot, this.seat(n, slot));
    this.attachLabel(brainrot);
    return brainrot;
  }

  private attachLabel(brainrot: Brainrot): void {
    brainrot.label?.remove();
    const label = this.ctx.labels.create('resident-tag');
    label.element.textContent = brainrot.gold ? `✨ ${brainrot.def.name}` : brainrot.def.name;
    label.element.style.color = brainrot.gold ? GOLD_COLOR : RARITIES[brainrot.def.rarity].color;
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
      if (!insideBox(from, other.layout.interior)) continue;
      return other === n && !includeOwn ? [] : [other.layout.entrance.clone()];
    }
    if (from.z >= YARD_Z - 0.5) return [];
    const gap = GAPS_X.reduce((a, b) => (Math.abs(b - from.x) < Math.abs(a - from.x) ? b : a));
    return [new THREE.Vector3(gap, 0, from.z), new THREE.Vector3(gap, 0, YARD_Z)];
  }
}
