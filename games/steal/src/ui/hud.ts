import { formatNumber } from '@engine/format';
import { button, element, formatWait } from './dom';
import { heroIcon } from './hero-panel';

/** Окна: кнопками слева и круглой кнопкой героя справа. */
export type MenuId = 'upgrades' | 'cases' | 'wheel' | 'upgrader' | 'hero';

export interface HudCallbacks {
  onAction(): void;
  onAttack(): void;
  onMenu(menu: MenuId): void;
  onToggleMute(): void;
  onToggleMusic(): void;
}

/** Что показывает большая кнопка действия (купить, открыть место и т. п.). */
export interface ActionView {
  readonly title: string;
  readonly detail: string;
  readonly enabled: boolean;
}

/** Кнопки окон слева: значок, подпись и клавиша. */
const MENUS: readonly { readonly id: MenuId; readonly icon: string; readonly text: string; readonly key: string }[] = [
  { id: 'upgrades', icon: '⚡', text: 'Прокачка', key: 'U' },
  { id: 'cases', icon: '🎁', text: 'Кейсы', key: 'K' },
  { id: 'wheel', icon: '🎡', text: 'Колесо', key: 'L' },
  { id: 'upgrader', icon: '♨️', text: 'Парилка', key: 'P' },
];

/** Интерфейс поверх игры: монеты, доход, кнопки действия, веника и окон, объявления. */
export class Hud {
  private readonly root: HTMLDivElement;
  private readonly wallet: HTMLDivElement;
  private readonly coinIcon: HTMLSpanElement;
  private readonly coinIconUrl: string;
  private readonly coins: HTMLSpanElement;
  private readonly income: HTMLDivElement;
  private readonly boost: HTMLDivElement;
  private readonly menus = new Map<MenuId, HTMLButtonElement>();
  private readonly action: HTMLButtonElement;
  private readonly actionTitle: HTMLSpanElement;
  private readonly actionDetail: HTMLSpanElement;
  private readonly broom: HTMLButtonElement;
  private readonly mute: HTMLButtonElement;
  private readonly music: HTMLButtonElement;
  private readonly hero: HTMLButtonElement;
  private readonly banner: HTMLDivElement;
  private bannerTimer = 0;
  private lastCoins = -1;
  private lastIncome = -1;
  private lastAction = '';
  private lastRecharge = -1;
  private lastBoost = '';

  constructor(container: HTMLElement, coinIconUrl: string, callbacks: HudCallbacks) {
    this.root = element('div', 'hud');

    const wallet = element('div', 'hud-wallet');
    const icon = element('span', 'hud-coin-icon');
    icon.style.backgroundImage = `url("${coinIconUrl}")`;
    this.wallet = wallet;
    this.coinIcon = icon;
    this.coinIconUrl = coinIconUrl;
    this.coins = element('span', 'hud-coins', '0');
    this.income = element('div', 'hud-income');
    this.boost = element('div', 'hud-boost');
    this.boost.hidden = true;
    const row = element('div', 'hud-wallet-row');
    row.append(icon, this.coins);
    wallet.append(row, this.income, this.boost);

    const menus = element('div', 'hud-menus');
    for (const menu of MENUS) {
      const menuButton = button('hud-menu', '', () => callbacks.onMenu(menu.id));
      menuButton.title = menu.text;
      menuButton.append(element('span', 'hud-menu-icon', menu.icon), element('span', 'hud-menu-text', menu.text), element('kbd', 'hud-key', menu.key));
      this.menus.set(menu.id, menuButton);
      menus.append(menuButton);
    }
    const left = element('div', 'hud-left');
    left.append(wallet, menus);

    this.mute = button('hud-round hud-mute', '', () => callbacks.onToggleMute());
    this.music = button('hud-round hud-music', '🎵', () => callbacks.onToggleMusic());
    this.hero = button('hud-round hud-hero', '', () => callbacks.onMenu('hero'));
    this.hero.title = 'Герой';

    this.broom = button('hud-broom', '🧹', () => callbacks.onAttack(), true);
    this.broom.title = 'Шлёпнуть веником';
    this.broom.append(element('kbd', 'hud-key', 'F'));

    this.action = button('hud-action', '', () => callbacks.onAction(), true);
    this.actionTitle = element('span', 'hud-action-title');
    this.actionDetail = element('span', 'hud-action-detail');
    this.action.append(this.actionTitle, this.actionDetail, element('kbd', 'hud-key', 'E'));
    this.action.hidden = true;

    this.banner = element('div', 'hud-banner');
    this.root.append(left, this.mute, this.music, this.hero, this.broom, this.action, this.banner);
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

  /** Ускоритель «×2 к доходу»: сколько осталось (0 — не действует). */
  setBoost(msLeft: number): void {
    const text = msLeft > 0 ? `⚡ ×2 доход · ${formatWait(msLeft)}` : '';
    if (text === this.lastBoost) return;
    this.lastBoost = text;
    this.boost.hidden = text === '';
    this.boost.textContent = text;
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

  /** Отметка на кнопке окна: там есть что взять (бесплатный кейс, спин, доступная прокачка). */
  setMenuBadge(menu: MenuId, show: boolean): void {
    this.menus.get(menu)?.classList.toggle('has-offer', show);
  }

  setMuted(muted: boolean): void {
    this.mute.textContent = muted ? '🔇' : '🔊';
    this.mute.title = muted ? 'Включить звук' : 'Выключить звук';
  }

  /** Портрет героя на круглой кнопке. */
  setHero(sheetUrl: string): void {
    this.hero.replaceChildren(heroIcon(sheetUrl, 40), element('kbd', 'hud-key', 'H'));
  }

  setMusic(on: boolean): void {
    this.music.classList.toggle('off', !on);
    this.music.title = on ? 'Выключить музыку' : 'Включить музыку';
  }

  /**
   * Монеты вылетают из точки экрана (x, y — пиксели внутри игры) и летят в кошелёк.
   * Кошелёк подпрыгивает, когда долетает каждая.
   */
  flyCoins(x: number, y: number, count: number): void {
    const box = this.root.getBoundingClientRect();
    const target = this.coinIcon.getBoundingClientRect();
    const tx = target.left - box.left + target.width / 2;
    const ty = target.top - box.top + target.height / 2;
    for (let i = 0; i < count; i++) {
      const coin = element('span', 'fly-coin');
      coin.style.backgroundImage = `url("${this.coinIconUrl}")`;
      this.root.append(coin);
      // сначала монетки разлетаются фонтанчиком, потом дугой летят к кошельку
      const bx = x + (Math.random() - 0.5) * 70;
      const by = y - 30 - Math.random() * 45;
      const animation = coin.animate(
        [
          { transform: `translate(${x}px, ${y}px) scale(0.5)` },
          { transform: `translate(${bx}px, ${by}px) scale(1)`, offset: 0.3 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.75)` },
        ],
        { duration: 620 + i * 50, delay: i * 45, easing: 'cubic-bezier(0.4, 0, 0.8, 0.6)', fill: 'backwards' },
      );
      animation.onfinish = () => {
        coin.remove();
        this.wallet.classList.remove('bump');
        void this.wallet.offsetWidth;
        this.wallet.classList.add('bump');
      };
    }
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
