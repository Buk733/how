import { formatNumber } from '@engine/format';

export interface HudCallbacks {
  onAction(): void;
  onToggleMute(): void;
}

/** Что показывает большая кнопка действия (купить, открыть место и т. п.). */
export interface ActionView {
  readonly title: string;
  readonly detail: string;
  readonly enabled: boolean;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

/** Интерфейс поверх игры: монеты, доход, кнопка действия, объявления. */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly coins: HTMLSpanElement;
  private readonly income: HTMLDivElement;
  private readonly action: HTMLButtonElement;
  private readonly actionTitle: HTMLSpanElement;
  private readonly actionDetail: HTMLSpanElement;
  private readonly mute: HTMLButtonElement;
  private readonly banner: HTMLDivElement;
  private bannerTimer = 0;
  private lastCoins = -1;
  private lastIncome = -1;
  private lastAction = '';

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

    this.mute = element('button', 'hud-mute');
    this.mute.type = 'button';
    this.mute.addEventListener('pointerdown', (event) => event.stopPropagation());
    this.mute.addEventListener('click', () => callbacks.onToggleMute());

    this.action = element('button', 'hud-action');
    this.action.type = 'button';
    this.actionTitle = element('span', 'hud-action-title');
    this.actionDetail = element('span', 'hud-action-detail');
    const key = element('kbd', 'hud-action-key', 'E');
    this.action.append(this.actionTitle, this.actionDetail, key);
    this.action.addEventListener('pointerdown', (event) => {
      event.stopPropagation(); // не запускать джойстик
      event.preventDefault();
      callbacks.onAction();
    });

    this.banner = element('div', 'hud-banner');
    this.action.hidden = true;
    this.root.append(wallet, this.mute, this.action, this.banner);
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

  setMuted(muted: boolean): void {
    this.mute.textContent = muted ? '🔇' : '🔊';
    this.mute.title = muted ? 'Включить звук' : 'Выключить звук';
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
