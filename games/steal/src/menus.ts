import { formatNumber } from '@engine/format';
import { caseOdds, casePayment, freeCaseIn, isFirstCase, payForCase, rarityOdds, rollCase, type CaseDrop } from './cases';
import { GOLD_COLOR } from './carpet';
import { REWARDS, UPGRADES } from './config';
import type { GameContext } from './context';
import { CASES, caseById, FREE_CASE_ID } from './data/cases';
import { CHARACTERS, type CharacterDef } from './data/characters';
import { HEROES, isHeroId, type HeroId } from './data/heroes';
import { t } from './i18n';
import { spriteUrl } from './data/sprites';
import { RARITIES } from './data/rarity';
import { sellValue, totalIncome, unitIncome, unitName } from './economy';
import type { Home, RewardResult } from './home';
import { characterNearTier, playerPower } from './neighbors';
import type { OfflineEarnings } from './offline';
import { RetentionMenus, type RetentionActions, type RetentionMenuId } from './retention-menus';
import { ShopMenus, type ShopActions, type ShopMenuId, type ShopPlatform } from './shop-menus';
import { describeRivals } from './rivals';
import { CasePanel, type CaseCardView, type CaseResultView, type ReelItem } from './ui/case-panel';
import { HeroPanel } from './ui/hero-panel';
import type { MenuId } from './ui/hud';
import type { Modal } from './ui/modal';
import { UpgradePanel, type UpgradeRowView } from './ui/upgrade-panel';
import { UpgraderPanel } from './ui/upgrader-panel';
import { WheelPanel } from './ui/wheel-panel';
import { rollUpgrade, upgradeTargets, type UpgradeTarget } from './upgrader';
import { buyUpgrade, checkUpgrade, describeUpgrade, maxLevel, UPGRADE_IDS, type UpgradeId } from './upgrades';
import { coinsPrize, rollWheel, spinState, startBoost, useSpin, WHEEL, WHEEL_CHARACTER_GOLD, wheelChances } from './wheel';

/** На каком месте ленты кейса стоит выпавший персонаж. */
const REEL_WINNER = 40;
const REEL_LENGTH = 46;

/** Что окна просят у игры. */
export interface MenuActions extends RetentionActions, ShopActions {
  /** Сменить героя. */
  pickHero(id: HeroId): void;
}

/**
 * Окна поверх игры: прокачка, кейсы, колесо удачи, парилка, выбор героя, окна удержания
 * (RetentionMenus) и площадки — магазин и рейтинг (ShopMenus). Открыто не больше одного; всплывающие сами (доход вне игры, награда за вход)
 * ждут в очереди, пока игрок не закроет текущее. Награды выдаются, когда лента или колесо
 * остановились; если окно закрыли раньше или вкладку свернули — сразу (settle), чтобы ничего не пропало.
 */
export class Menus {
  private readonly ctx: GameContext;
  private readonly home: Home;
  private readonly actions: MenuActions;
  private readonly upgrades: UpgradePanel;
  private readonly cases: CasePanel;
  private readonly wheel: WheelPanel;
  private readonly upgrader: UpgraderPanel;
  private readonly hero: HeroPanel;
  private readonly retention: RetentionMenus;
  private readonly store: ShopMenus;
  private readonly modals: Record<MenuId, Modal>;
  private current: MenuId | null = null;
  /** Окна, которые всплывут сами, когда игрок закроет текущее. */
  private readonly queue: MenuId[] = [];
  /** Награда, которую покажет и выдаст остановившаяся анимация. */
  private pending: (() => void) | null = null;
  private upgraderSlot: number | null = null;
  private upgraderTarget: number | null = null;
  private insured = false;
  private adBusy = false;

  constructor(container: HTMLElement, ctx: GameContext, home: Home, platform: ShopPlatform, actions: MenuActions) {
    this.ctx = ctx;
    this.home = home;
    this.actions = actions;
    const close = () => this.close();
    this.upgrades = new UpgradePanel(container, (id) => this.buyUpgrade(id as UpgradeId), close);
    this.cases = new CasePanel(container, {
      onOpen: (id) => this.openCase(id),
      onClose: close,
      onTick: () => ctx.audio.blip('tick'),
    });
    this.wheel = new WheelPanel(
      container,
      WHEEL.map((sector, i) => ({ icon: sector.icon, label: sector.label, color: sector.color, chance: wheelChances()[i] })),
      { onSpin: (kind) => void this.spin(kind), onClose: close, onTick: () => ctx.audio.blip('tick'), onStop: () => this.settle() },
    );
    this.upgrader = new UpgraderPanel(container, {
      onSelectSource: (slot) => this.selectSource(slot),
      onSelectTarget: (index) => {
        this.upgraderTarget = index;
        this.upgrader.resetHeat();
      },
      onRun: () => this.runUpgrade(),
      onInsure: () => void this.insure(),
      onClose: close,
      onDone: () => this.settle(),
    });
    this.hero = new HeroPanel(
      container,
      (id) => {
        if (isHeroId(id)) actions.pickHero(id);
      },
      close,
    );
    this.retention = new RetentionMenus(container, ctx, actions, close);
    this.store = new ShopMenus(container, ctx, platform, actions, close);
    this.modals = {
      upgrades: this.upgrades.modal,
      cases: this.cases.modal,
      wheel: this.wheel.modal,
      upgrader: this.upgrader.modal,
      hero: this.hero.modal,
      ...this.retention.modals,
      ...this.store.modals,
    };
    for (const menu of ['shop', 'leaderboard'] as const) ctx.hud.setMenuVisible(menu, this.store.available(menu));
  }

  /** Какое окно открыто. */
  get open(): MenuId | null {
    return this.current;
  }

  /** Открыть окно (или закрыть, если оно уже открыто). Окна, которого нет на площадке, не открываются. */
  toggle(menu: MenuId): void {
    if ((menu === 'shop' || menu === 'leaderboard') && !this.store.available(menu)) return;
    if (this.current === menu) {
      this.close();
      return;
    }
    this.closeCurrent();
    this.show(menu);
  }

  /** Окно, которое всплывает само: сразу, если ничего не открыто, иначе — после текущего. */
  popup(menu: MenuId): void {
    if (this.current === null) this.show(menu);
    else if (this.current !== menu && !this.queue.includes(menu)) this.queue.push(menu);
  }

  /** Доход вне игры: окно «С возвращением!» всплывёт первым. */
  offerWelcome(earned: OfflineEarnings): void {
    this.retention.offerWelcome(earned);
    this.popup('welcome');
  }

  /** Игрок закрыл окно: следующее из очереди всплывает само. */
  close(): void {
    this.closeCurrent();
    const next = this.queue.shift();
    if (next) this.show(next);
  }

  /** Выдать отложенную награду прямо сейчас (окно закрыли, вкладку свернули). */
  settle(): void {
    const pending = this.pending;
    this.pending = null;
    pending?.();
    this.retention.settle();
  }

  private show(menu: MenuId): void {
    this.current = menu;
    this.modals[menu].setOpen(true);
    if (menu === 'cases') this.cases.showShop();
    if (menu === 'upgrader') this.upgrader.resetHeat();
    if (menu === 'shop' || menu === 'leaderboard') this.store.opened(menu);
    this.refresh();
  }

  private closeCurrent(): void {
    this.settle();
    this.cases.stop();
    this.wheel.stop();
    this.upgrader.stop();
    for (const modal of Object.values(this.modals)) modal.setOpen(false);
    this.current = null;
  }

  /** Каждый кадр: отметки на кнопках и содержимое открытого окна. */
  update(): void {
    const { save, hud } = this.ctx;
    const now = Date.now();
    hud.setMenuBadge('upgrades', UPGRADE_IDS.some((id) => checkUpgrade(save, id).ok));
    hud.setMenuBadge('cases', freeCaseIn(save, now) === 0 || Object.keys(save.keys).length > 0);
    hud.setMenuBadge('wheel', spinState(save, now).free);
    this.retention.badges();
    this.refresh();
  }

  private refresh(): void {
    switch (this.current) {
      case 'upgrades':
        this.upgrades.render(this.upgradeRows());
        this.upgrades.setNote(describeRivals(this.ctx.save.stats.peakIncome));
        break;
      case 'cases':
        this.cases.render(this.caseCards());
        break;
      case 'wheel':
        this.wheel.render(spinState(this.ctx.save, Date.now()));
        break;
      case 'upgrader':
        this.refreshUpgrader();
        break;
      case 'hero':
        this.hero.render(
          HEROES.map((hero) => ({ ...hero, sheetUrl: spriteUrl(hero.sprite), selected: hero.id === this.ctx.save.hero })),
        );
        break;
      case 'shop':
      case 'leaderboard':
        this.store.refresh(this.current satisfies ShopMenuId);
        break;
      case null:
        break;
      default:
        this.retention.refresh(this.current satisfies RetentionMenuId);
    }
  }

  // ---------------------------------------------------------------- прокачка

  private upgradeRows(): UpgradeRowView[] {
    const { save } = this.ctx;
    return UPGRADE_IDS.map((id) => {
      const level = save.upgrades[id];
      const top = level >= maxLevel(id);
      return {
        id,
        icon: UPGRADES[id].icon,
        name: t.upgrades.names[id],
        level,
        maxLevel: maxLevel(id),
        now: describeUpgrade(id, level),
        next: top ? null : describeUpgrade(id, level + 1),
        cost: top ? null : UPGRADES[id].costs[level],
        affordable: checkUpgrade(save, id).ok,
      };
    });
  }

  private buyUpgrade(id: UpgradeId): void {
    if (!buyUpgrade(this.ctx.save, id)) {
      this.ctx.audio.blip('error');
      return;
    }
    this.ctx.audio.blip('unlock');
    this.ctx.labels.float(t.upgrades.float(UPGRADES[id].icon, this.ctx.save.upgrades[id]), this.ctx.player.position.clone().setY(2.2), 'float-coins');
    this.ctx.markDirty(true);
  }

  // ---------------------------------------------------------------- кейсы

  private caseCards(): CaseCardView[] {
    const { save } = this.ctx;
    const now = Date.now();
    const first = isFirstCase(save);
    return CASES.map((box) => ({
      id: box.id,
      name: box.name,
      icon: box.icon,
      color: box.color,
      price: box.price,
      rarities: rarityOdds(box, CHARACTERS).map((r) => ({ name: RARITIES[r.rarity].name, color: RARITIES[r.rarity].color, chance: r.chance })),
      gold: box.gold,
      contents: caseOdds(box, CHARACTERS).map((o) => ({ name: o.def.name, sprite: o.def.sprite, color: RARITIES[o.def.rarity].color, chance: o.chance })),
      payment: casePayment(save, box, now),
      keys: save.keys[box.id] ?? 0,
      freeIn: box.id === FREE_CASE_ID ? freeCaseIn(save, now) : null,
      note: first && box.id === FREE_CASE_ID ? t.cases.firstNote : '',
    }));
  }

  private openCase(caseId: string): void {
    const box = caseById(caseId);
    if (!box || this.cases.spinning) return;
    this.settle();
    const { save, rng } = this.ctx;
    const first = isFirstCase(save);
    if (!payForCase(save, box, Date.now())) {
      this.ctx.audio.blip('error');
      return;
    }
    this.ctx.markDirty(true);
    const drop = rollCase(rng, box, CHARACTERS, first);
    // лента — честные случайные выпадения этого кейса (с той же гарантией), выпавший стоит на REEL_WINNER
    const strip = Array.from({ length: REEL_LENGTH }, (_, i) => (i === REEL_WINNER ? drop : rollCase(rng, box, CHARACTERS, first)));
    let placement = '';
    this.pending = () => {
      placement = this.placementText(this.home.placeReward(drop.def, drop.gold));
      this.ctx.playVoice(drop.def);
      this.ctx.audio.blip(drop.gold ? 'gold' : 'win');
    };
    const resolve = (): CaseResultView => {
      this.settle();
      return {
        title: t.cases.dropped(unitName(drop.def, drop.gold)),
        color: drop.gold ? GOLD_COLOR : RARITIES[drop.def.rarity].color,
        gold: drop.gold,
        detail: placement,
      };
    };
    this.cases.showOpening(caseId, strip.map((d) => this.reelItem(d)), REEL_WINNER, resolve);
  }

  private reelItem(drop: CaseDrop): ReelItem {
    return {
      name: drop.def.name,
      sprite: drop.gold ? drop.def.goldSprite : drop.def.sprite,
      color: drop.gold ? GOLD_COLOR : RARITIES[drop.def.rarity].color,
      gold: drop.gold,
    };
  }

  private placementText(result: RewardResult): string {
    if (result.kind === 'sold') return t.cases.sold(formatNumber(result.coins));
    if (!result.replaced) return t.cases.seated;
    const { def, gold } = result.replaced;
    return t.cases.replaced(unitName(def, gold), formatNumber(sellValue(def, gold)));
  }

  // ---------------------------------------------------------------- колесо удачи

  private async spin(kind: 'free' | 'ad'): Promise<void> {
    if (this.wheel.spinning || this.adBusy) return;
    this.settle();
    const { save } = this.ctx;
    if (kind === 'ad') {
      if (spinState(save, Date.now()).adLeft === 0) return;
      this.adBusy = true;
      const rewarded = await this.actions.showRewardedAd();
      this.adBusy = false;
      if (!rewarded || !useSpin(save, Date.now(), 'ad')) return;
    } else if (!useSpin(save, Date.now(), 'free')) {
      this.ctx.audio.blip('error');
      return;
    }
    this.ctx.markDirty(true);
    const index = rollWheel(this.ctx.rng);
    const { prize, icon } = WHEEL[index];
    let text = '';
    const { rng } = this.ctx;
    switch (prize.kind) {
      case 'coins': {
        const coins = coinsPrize(prize, totalIncome(save, Date.now()));
        text = t.wheel.coins(icon, formatNumber(coins));
        this.pending = () => {
          save.coins += coins;
          this.ctx.labels.float(`+${formatNumber(coins)}`, this.ctx.player.position.clone().setY(2.2), 'float-coins');
        };
        break;
      }
      case 'key': {
        text = t.wheel.key(caseById(prize.caseId)?.name ?? prize.caseId);
        this.pending = () => {
          save.keys[prize.caseId] = (save.keys[prize.caseId] ?? 0) + 1;
        };
        break;
      }
      case 'boost':
        text = t.wheel.boost(REWARDS.boostMinutes);
        this.pending = () => startBoost(save, Date.now());
        break;
      case 'character': {
        const def = characterNearTier(rng, CHARACTERS, Math.max(0, playerPower(save.slots)));
        const gold = rng.chance(WHEEL_CHARACTER_GOLD);
        text = t.wheel.character(icon, unitName(def, gold));
        this.pending = () => this.home.placeReward(def, gold);
        break;
      }
    }
    const settle = this.pending;
    this.pending = () => {
      settle?.();
      this.ctx.audio.blip('win');
      this.ctx.markDirty(true);
    };
    this.wheel.spinTo(index, t.wheel.result(text));
  }

  // ---------------------------------------------------------------- парилка

  private selectSource(slot: number): void {
    this.upgraderSlot = slot;
    this.upgraderTarget = null;
    this.upgrader.resetHeat();
  }

  private upgraderSource(): { slot: number; def: CharacterDef; gold: boolean } | null {
    const units = this.home.seatedUnits();
    return units.find((u) => u.slot === this.upgraderSlot) ?? null;
  }

  private upgraderTargets(): UpgradeTarget[] {
    const source = this.upgraderSource();
    return source ? upgradeTargets(source.def, source.gold, CHARACTERS) : [];
  }

  private refreshUpgrader(): void {
    const sources = this.home.seatedUnits();
    // выбранный персонаж пропал (испарился, украли) — берём первого, итог на шкале не стираем
    if (this.upgraderSlot !== null && !sources.some((s) => s.slot === this.upgraderSlot)) {
      this.upgraderSlot = sources[0]?.slot ?? null;
      this.upgraderTarget = null;
    }
    if (this.upgraderSlot === null && sources.length > 0) this.upgraderSlot = sources[0].slot;
    const targets = this.upgraderTargets();
    if (this.upgraderTarget !== null && this.upgraderTarget >= targets.length) this.upgraderTarget = null;
    const view = (def: CharacterDef, gold: boolean) => ({
      name: def.name,
      sprite: gold ? def.goldSprite : def.sprite,
      color: gold ? GOLD_COLOR : RARITIES[def.rarity].color,
      gold,
      income: unitIncome(def, gold),
    });
    this.upgrader.render({
      sources: sources.map((s) => ({ ...view(s.def, s.gold), slot: s.slot })),
      selectedSlot: sources.some((s) => s.slot === this.upgraderSlot) ? this.upgraderSlot : null,
      targets: targets.map((target) => ({ ...view(target.def, target.gold), chance: target.chance })),
      selectedTarget: this.upgraderTarget,
      insured: this.insured,
    });
  }

  private runUpgrade(): void {
    if (this.upgrader.busy) return;
    const source = this.upgraderSource();
    const target = this.upgraderTarget !== null ? this.upgraderTargets()[this.upgraderTarget] : undefined;
    if (!source || !target) {
      this.ctx.audio.blip('error');
      return;
    }
    this.settle();
    const { roll, success } = rollUpgrade(this.ctx.rng, target.chance);
    const insured = this.insured;
    this.insured = false;
    const from = unitName(source.def, source.gold);
    const to = unitName(target.def, target.gold);
    const text = success ? t.upgrader.success(from, to) : insured ? t.upgrader.saved(from) : t.upgrader.lost(from);
    this.pending = () => {
      const slot = this.ctx.save.slots[source.slot];
      // пока шёл жар, персонажа могли украсть — тогда превращать некого
      if (slot.id !== source.def.id || slot.gold !== source.gold) return;
      if (success) {
        this.home.replaceInSlot(source.slot, target.def, target.gold);
        this.ctx.save.stats.upgraded++;
        this.ctx.playVoice(target.def);
        this.ctx.audio.blip(target.gold ? 'gold' : 'win');
      } else {
        if (!insured) this.home.removeFromSlot(source.slot);
        this.ctx.audio.blip('lose');
      }
      this.upgraderTarget = null;
      this.ctx.markDirty(true);
    };
    this.upgrader.playHeat(roll, success, text);
  }

  private async insure(): Promise<void> {
    if (this.insured || this.adBusy) return;
    this.adBusy = true;
    const rewarded = await this.actions.showRewardedAd();
    this.adBusy = false;
    if (rewarded) {
      this.insured = true;
      this.ctx.audio.blip('unlock');
    }
  }
}
