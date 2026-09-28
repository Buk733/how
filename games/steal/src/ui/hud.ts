import { formatNumber } from '@engine/format';

export interface HudCallbacks {
  onAction(): void;
  onAttack(): void;
  onToggleUpgrades(): void;
  onToggleMute(): void;
  onToggleMusic(): void;
}

/** Что показывает большая кнопка действия (купить, открыть место и т. п.). */
export interface ActionView {
  readonly title: string;
  readonly detail: string;
  readonly enabled: boolean;
}

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/** Кнопка интерфейса, нажатие которой не запускает джойстик и удар мышью. */
function button(className: string, text: string, onPress: () => void, instant = false): HTMLButtonElement {
  const el = element('button', className, text);
  el.type = 'button';
  el.addEventListener('pointerdown', (event) => {
    event.stopPropagation();
    if (!instant) return;
    event.preventDefault();
    onPress();
  });
  if (!instant) el.addEventListener('click', () => onPress());
  return el;
}

/** Интерфейс поверх игры: монеты, доход, кнопки действия, веника и прокачки, объявления. */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly coins: HTMLSpanElement;
  private readonly income: HTMLDivElement;
  private readonly upgrades: HTMLButtonElement;
  private readonly action: HTMLButtonElement;
  private readonly actionTitle: HTMLSpanElement;
  private readonly actionDetail: HTMLSpanElement;
  private readonly broom: HTMLButtonElement;
  private readonly mute: HTMLButtonElement;
  private readonly music: HTMLButtonElement;
  private readonly banner: HTMLDivElement;
  private bannerTimer = 0;
  private lastCoins = -1;
  private lastIncome = -1;
  private lastAction = '';
  private lastRecharge = -1;

  constructor(container: HTMLElement, coinIconUrl: string, callbacks: HudCallbacks) {
    this.root = element('div', 'hud');

    const wallet = element('div', 'hud-wallet');
    const icon = element('span', 'hud-coin-icon');
    icon.style.backgroundImage = `url("${coinIconUrl}")`;
    this.coins = element('span', 'hud-coins', '0');
    this.income = element('div', 'hud-income');
    const row = element('div', 'hud-wallet-row');
    row.append(icon, this.coins);
    wallet.append(row, this.income);

    this.upgrades = button('hud-upgrades', '⚡ Прокачка', () => callbacks.onToggleUpgrades());
    this.upgrades.append(element('kbd', 'hud-key', 'U'));
    const left = element('div', 'hud-left');
    left.append(wallet, this.upgrades);

    this.mute = button('hud-round hud-mute', '', () => callbacks.onToggleMute());
    this.music = button('hud-round hud-music', '🎵', () => callbacks.onToggleMusic());

    this.broom = button('hud-broom', '🧹', () => callbacks.onAttack(), true);
    this.broom.title = 'Шлёпнуть веником';
    this.broom.append(element('kbd', 'hud-key', 'F'));

    this.action = button('hud-action', '', () => callbacks.onAction(), true);
    this.actionTitle = element('span', 'hud-action-title');
    this.actionDetail = element('span', 'hud-action-detail');
    this.action.append(this.actionTitle, this.actionDetail, element('kbd', 'hud-key', 'E'));
    this.action.hidden = true;

    this.banner = element('div', 'hud-banner');
    this.root.append(left, this.mute, this.music, this.broom, this.action, this.banner);
    container.append(this.root);
  }

  setWallet(coins: number, income: number): void {
    const shownCoins = Math.floor(coins);
    if (shownCoins !== this.lastCoins) {
      this.lastCoins = shownCoins;
      this.coins.textContent = formatNumber(shownCoins);
    }
    if (income !== this.lastIncome) {
      this.lastIncome = income;
      this.income.textContent = income > 0 ? `+${formatNumber(income)} в секунду` : 'Купи персонажа на дорожке';
    }
  }

  setAction(view: ActionView | null): void {
    const key = view ? `${view.title}|${view.detail}|${view.enabled}` : '';
    if (key === this.lastAction) return;
    this.lastAction = key;
    this.action.hidden = view === null;
    if (!view) return;
    this.actionTitle.textContent = view.title;
    this.actionDetail.textContent = view.detail;
    this.action.classList.toggle('disabled', !view.enabled);
  }

  /** Кнопка веника: recharge — сколько осталось до перезарядки (1…0), usable — можно ли бить сейчас. */
  setBroom(recharge: number, usable: boolean): void {
    const shown = Math.ceil(recharge * 36) / 36;
    if (shown !== this.lastRecharge) {
      this.lastRecharge = shown;
      this.broom.style.setProperty('--recharge', String(shown));
    }
    this.broom.classList.toggle('disabled', !usable);
  }

  /** Отметка на кнопке прокачки: есть что купить. */
  setUpgradesBadge(show: boolean): void {
    this.upgrades.classList.toggle('has-offer', show);
  }

  setMuted(muted: boolean): void {
    this.mute.textContent = muted ? '🔇' : '🔊';
    this.mute.title = muted ? 'Включить звук' : 'Выключить звук';
  }

  setMusic(on: boolean): void {
    this.music.classList.toggle('off', !on);
    this.music.title = on ? 'Выключить музыку' : 'Включить музыку';
  }

  /** Крупное объявление по центру сверху. */
  showBanner(text: string, color = '#ffcd75', duration = 2600): void {
    this.banner.textContent = text;
    this.banner.style.color = color;
    this.banner.classList.add('visible');
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('visible'), duration);
  }

  dispose(): void {
    window.clearTimeout(this.bannerTimer);
    this.root.remove();
  }
}
