import { formatNumber } from '@engine/format';
import { distanceXZ } from '@engine/math';
import { AUDIO, BUY_RANGE, CARPET } from './config';
import type { Action, GameContext } from './context';
import { CHARACTERS, type CharacterDef } from './data/characters';
import { RARITIES } from './data/rarity';
import { checkPurchase } from './economy';
import type { Brainrot } from './entities/brainrot';
import type { Home } from './home';
import { tierOf } from './neighbors';
import type { Spawner } from './spawner';

/** Id фоновой музыки, которая играет, когда на дорожку выходит редкий персонаж. */
export const RARE_THEME = 'rare-theme';

/** Мемная дорожка: персонажи идут мимо бань, их можно купить. */
export class Carpet {
  readonly walkers: Brainrot[] = [];
  /** Обучающий персонаж: идёт прямо к игроку и точно по карману. */
  tutorialWalker: Brainrot | null = null;
  private readonly ctx: GameContext;
  private readonly home: Home;
  private readonly spawner: Spawner;

  constructor(ctx: GameContext, home: Home, spawner: Spawner) {
    this.ctx = ctx;
    this.home = home;
    this.spawner = spawner;
  }

  /** Чтобы дорожка не была пустой в первые секунды. */
  prefill(): void {
    const span = CARPET.endX - CARPET.startX;
    for (let i = 0; i < 9; i++) this.spawn(this.spawner.pick(), CARPET.startX + span * (0.06 + i * 0.105), false);
  }

  update(dt: number): void {
    const next = this.spawner.update(dt);
    if (next && this.walkers.length < CARPET.maxWalkers) this.spawn(next, CARPET.startX, true);

    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const walker = this.walkers[i];
      walker.update(dt);
      if (walker.label) {
        walker.label.anchor.set(walker.position.x, walker.position.y + 2.05, walker.position.z);
        walker.label.element.classList.toggle('cant-afford', this.ctx.save.coins < walker.def.price);
      }
      if (walker.gone) {
        this.walkers.splice(i, 1);
        this.ctx.removeBrainrot(walker);
        if (walker === this.tutorialWalker) this.tutorialWalker = null;
      }
    }
  }

  /** Купить ближайшего персонажа на дорожке. */
  findAction(handsFull: boolean): Action | null {
    let nearest: Brainrot | null = null;
    let nearestDistance = BUY_RANGE;
    for (const walker of this.walkers) {
      const distance = distanceXZ(this.ctx.player.position, walker.position);
      if (walker.state === 'walking' && distance < nearestDistance) {
        nearest = walker;
        nearestDistance = distance;
      }
    }
    if (!nearest) return null;
    const target = nearest;
    const title = `Купить «${target.def.name}»`;
    if (handsFull) return { view: { title, detail: 'руки заняты — отнеси добычу в баню', enabled: false }, run: () => {} };
    const check = checkPurchase(this.ctx.save, target.def);
    const detail = check.ok
      ? check.replaces
        ? `💰 ${formatNumber(target.def.price)} · заменит «${check.replaces.name}»`
        : `💰 ${formatNumber(target.def.price)}`
      : check.reason === 'coins'
        ? `нужно 💰 ${formatNumber(target.def.price)}`
        : 'нет мест — открой новое';
    return { view: { title, detail, enabled: check.ok }, run: () => this.buy(target) };
  }

  /** Выпускает обучающего персонажа чуть левее игрока, убирая соседей по дорожке. */
  spawnTutorialWalker(): void {
    const cheapest = CHARACTERS.reduce((a, b) => (b.price < a.price ? b : a));
    const x = Math.max(CARPET.startX, this.ctx.player.position.x - CARPET.walkSpeed * 3);
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      if (Math.abs(this.walkers[i].position.x - x) < 3.5) this.ctx.removeBrainrot(this.walkers.splice(i, 1)[0]);
    }
    this.tutorialWalker = this.spawn(cheapest, x, false);
  }

  private buy(walker: Brainrot): void {
    const check = checkPurchase(this.ctx.save, walker.def);
    if (!check.ok) return;
    const { save } = this.ctx;
    save.coins -= walker.def.price;
    save.stats.bought++;
    this.walkers.splice(this.walkers.indexOf(walker), 1);
    walker.label?.remove();
    walker.label = null;
    this.home.place(walker, check);
    this.ctx.playVoice(walker.def);
    this.ctx.audio.blip('buy');
    this.ctx.labels.float(`-${formatNumber(walker.def.price)}`, walker.position.clone().setY(2), 'float-spend');
    if (walker === this.tutorialWalker) this.tutorialWalker = null;
    this.ctx.tutorialEvent('bought');
  }

  private spawn(def: CharacterDef, x: number, announce: boolean): Brainrot {
    const walker = this.ctx.createBrainrot(def);
    walker.position.set(x, 0, CARPET.z);
    const rarity = RARITIES[def.rarity];
    const label = this.ctx.labels.create('walker-tag');
    const name = document.createElement('b');
    const rarityName = document.createElement('i');
    const price = document.createElement('span');
    name.textContent = def.name;
    name.style.color = rarity.color;
    rarityName.textContent = rarity.name;
    price.textContent = `💰 ${formatNumber(def.price)} · +${formatNumber(def.income)}/с`;
    label.element.append(name, rarityName, price);
    walker.label = label;
    this.walkers.push(walker);

    if (announce && tierOf(def.rarity) >= tierOf(AUDIO.musicFromRarity)) {
      this.ctx.hud.showBanner(`На дорожке ${rarity.name.toLowerCase()} «${def.name}»!`, rarity.color, 3500);
      if (!this.ctx.audio.isPlaying(RARE_THEME)) this.ctx.audio.play(RARE_THEME, { volume: AUDIO.music });
    }
    return walker;
  }
}
