import { formatNumber } from '@engine/format';
import { GOLD_COLOR } from './carpet';
import { collectionProgress, hasCollected, isFound } from './collection';
import { OFFLINE } from './config';
import type { GameContext } from './context';
import { claimDaily, DAILY, dailyCoins, dailyState } from './daily';
import { caseById } from './data/cases';
import { CHARACTERS } from './data/characters';
import { RARITIES } from './data/rarity';
import { SECRETS } from './data/secrets';
import { totalIncome } from './economy';
import type { OfflineEarnings } from './offline';
import { canRebirth, rebirthCost, rebirthMultiplier } from './rebirth';
import { AlbumPanel } from './ui/album-panel';
import { DailyPanel, type DailyCellView } from './ui/daily-panel';
import type { Modal } from './ui/modal';
import { RebirthPanel } from './ui/rebirth-panel';
import { WelcomePanel } from './ui/welcome-panel';

/** Окна удержания: у каждого своя кнопка (кроме «С возвращением», оно всплывает само). */
export type RetentionMenuId = 'welcome' | 'daily' | 'album' | 'rebirth';

/** Что окна удержания просят у игры. */
export interface RetentionActions {
  /** Реклама за награду: true — игрок досмотрел, награду нужно выдать. */
  showRewardedAd(): Promise<boolean>;
  /** Перерождение: true — получилось. */
  rebirth(): boolean;
  /** Почему сейчас нельзя переродиться (несёшь добычу, идёт набег) или null. */
  rebirthBlocked(): string | null;
}

/** «×1,5». */
export function formatMultiplier(value: number): string {
  return `×${String(Math.round(value * 100) / 100).replace('.', ',')}`;
}

/** «2 ч 15 мин», «45 мин». */
export function formatAway(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${minutes} мин`;
  return rest > 0 ? `${hours} ч ${rest} мин` : `${hours} ч`;
}

/**
 * Окна, которые возвращают игрока: доход вне игры («С возвращением!»), награды за вход,
 * альбом коллекции и перерождение. Открывает и закрывает их Menus — открыто не больше одного окна.
 */
export class RetentionMenus {
  readonly modals: Readonly<Record<RetentionMenuId, Modal>>;
  private readonly ctx: GameContext;
  private readonly actions: RetentionActions;
  private readonly welcome: WelcomePanel;
  private readonly daily: DailyPanel;
  private readonly album: AlbumPanel;
  private readonly rebirth: RebirthPanel;
  private readonly close: () => void;
  /** Доход вне игры, который ещё не забрали. */
  private offline: OfflineEarnings | null = null;
  private adBusy = false;

  constructor(container: HTMLElement, ctx: GameContext, actions: RetentionActions, close: () => void) {
    this.ctx = ctx;
    this.actions = actions;
    this.close = close;
    this.welcome = new WelcomePanel(container, {
      onClaim: () => {
        this.claimWelcome(1);
        close();
      },
      onClaimAd: () => void this.claimWelcomeAd(),
      onClose: close,
    });
    this.daily = new DailyPanel(container, () => this.claimDaily(), close);
    this.album = new AlbumPanel(container, close);
    this.rebirth = new RebirthPanel(container, () => this.actions.rebirth(), close);
    this.modals = { welcome: this.welcome.modal, daily: this.daily.modal, album: this.album.modal, rebirth: this.rebirth.modal };
  }

  /** Монеты за время отсутствия ждут в окне «С возвращением!». */
  offerWelcome(earned: OfflineEarnings): void {
    this.offline = earned;
    const capped = earned.away > earned.seconds;
    this.welcome.show({
      away: formatAway(earned.away),
      coins: earned.coins,
      note: `Без тебя персонажи приносят ${Math.round(OFFLINE.rate * 100)}% дохода и копят не дольше ${OFFLINE.maxHours} ч${capped ? ' — заходи почаще!' : ''}`,
    });
  }

  /** Окно закрыли или вкладку свернули: доход вне игры выдаётся без удвоения, подтверждение сбрасывается. */
  settle(): void {
    if (!this.adBusy) this.claimWelcome(1);
    this.rebirth.resetConfirm();
  }

  /** Отметки на кнопках: можно забрать награду за вход, хватает на перерождение. */
  badges(): void {
    const { save, hud } = this.ctx;
    hud.setMenuBadge('daily', dailyState(save, Date.now()).available);
    hud.setMenuBadge('rebirth', canRebirth(save));
  }

  refresh(menu: RetentionMenuId): void {
    if (menu === 'daily') this.daily.render(this.dailyView());
    else if (menu === 'album') this.album.render(this.albumView());
    else if (menu === 'rebirth') this.rebirth.render(this.rebirthView());
  }

  // ---------------------------------------------------------------- доход вне игры

  private claimWelcome(factor: number): void {
    const earned = this.offline;
    if (!earned) return;
    this.offline = null;
    const coins = earned.coins * factor;
    this.ctx.save.coins += coins;
    this.ctx.save.stats.earned += coins;
    this.ctx.labels.float(`+${formatNumber(coins)}`, this.ctx.player.position.clone().setY(2.2), 'float-coins');
    this.ctx.audio.blip('coin');
    this.ctx.markDirty(true);
  }

  private async claimWelcomeAd(): Promise<void> {
    if (!this.offline || this.adBusy) return;
    this.adBusy = true;
    this.welcome.setBusy(true);
    const rewarded = await this.actions.showRewardedAd();
    this.adBusy = false;
    this.welcome.setBusy(false);
    if (!rewarded) return;
    this.claimWelcome(2);
    this.ctx.audio.blip('win');
    if (this.welcome.modal.isOpen) this.close();
  }

  // ---------------------------------------------------------------- награды за вход

  private dailyView() {
    const { save } = this.ctx;
    const now = Date.now();
    const state = dailyState(save, now);
    const income = totalIncome(save, now);
    // клетки до сегодняшней в этом круге календаря — забраны
    const cells: DailyCellView[] = DAILY.map((reward, i) => ({
      day: i + 1,
      icon: reward.icon,
      label: reward.label,
      amount: reward.prize.kind === 'coins' ? `💰 ${formatNumber(dailyCoins(reward.prize, income))}` : '',
      state: i < state.index || (i === state.index && !state.available) ? 'claimed' : i === state.index ? 'today' : 'future',
    }));
    return { cells, available: state.available, streak: state.streak, nextIn: state.nextIn };
  }

  private claimDaily(): void {
    const { save } = this.ctx;
    const now = Date.now();
    const claimed = claimDaily(save, now, totalIncome(save, now));
    if (!claimed) {
      this.ctx.audio.blip('error');
      return;
    }
    const { reward, coins } = claimed;
    const { prize } = reward;
    let text = `${reward.icon} ${reward.label}`;
    if (prize.kind === 'coins') {
      text = `💰 +${formatNumber(coins)} монет`;
      save.stats.earned += coins;
    } else if (prize.kind === 'key') {
      text = `🔑 Ключ: «${caseById(prize.caseId)?.name ?? prize.caseId}» — открой в кейсах!`;
    }
    this.ctx.hud.showBanner(`📅 День ${dailyState(save, now).streak}: ${text}`, '#a7f070', 3200);
    this.ctx.fx.sparkles(this.ctx.player.position, true);
    this.ctx.audio.blip('win');
    this.ctx.markDirty(true);
  }

  // ---------------------------------------------------------------- альбом

  private albumView() {
    const { save } = this.ctx;
    const progress = collectionProgress(save);
    return {
      ...progress,
      cards: CHARACTERS.map((def) => {
        const gold = hasCollected(save, def.id, true);
        const goldOnly = gold && !hasCollected(save, def.id, false);
        return {
          name: def.name,
          color: goldOnly ? GOLD_COLOR : RARITIES[def.rarity].color,
          sprite: goldOnly ? def.goldSprite : def.sprite,
          found: isFound(save, def.id),
          gold,
        };
      }),
      secrets: SECRETS.map((s) => ({ name: s.name, hint: s.hint, found: save.secrets.includes(s.id) })),
    };
  }

  // ---------------------------------------------------------------- перерождение

  private rebirthView() {
    const { save } = this.ctx;
    return {
      rebirths: save.rebirths,
      multiplier: formatMultiplier(rebirthMultiplier(save.rebirths)),
      nextMultiplier: formatMultiplier(rebirthMultiplier(save.rebirths + 1)),
      cost: rebirthCost(save.rebirths),
      coins: save.coins,
      blocked: this.actions.rebirthBlocked(),
    };
  }
}
