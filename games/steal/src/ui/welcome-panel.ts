import { formatNumber } from '@engine/format';
import { button, element } from './dom';
import { Modal } from './modal';

export interface WelcomeView {
  /** «2 ч 15 мин» — сколько игрока не было. */
  readonly away: string;
  readonly coins: number;
  /** Пояснение мелким шрифтом: какая доля дохода и не дольше скольких часов. */
  readonly note: string;
}

export interface WelcomeCallbacks {
  onClaim(): void;
  /** Реклама за награду: вдвое больше монет. */
  onClaimAd(): void;
  onClose(): void;
}

/** Окно «С возвращением!»: сколько персонажи напарили, пока игрока не было. */
export class WelcomePanel {
  readonly modal: Modal;
  private readonly away: HTMLElement;
  private readonly coins: HTMLDivElement;
  private readonly note: HTMLDivElement;
  private readonly claim: HTMLButtonElement;
  private readonly claimAd: HTMLButtonElement;

  constructor(container: HTMLElement, callbacks: WelcomeCallbacks) {
    this.modal = new Modal(container, '👋 С возвращением!', callbacks.onClose, 'welcome-panel');
    const lead = element('div', 'welcome-lead', 'Пока тебя не было ');
    this.away = element('b', 'welcome-away');
    lead.append(this.away, ', персонажи парились и напарили:');
    this.coins = element('div', 'welcome-coins');
    this.note = element('div', 'welcome-note');
    this.claim = button('buy-button free', '', () => callbacks.onClaim());
    this.claimAd = button('ad-button', '', () => callbacks.onClaimAd());
    const buttons = element('div', 'welcome-buttons');
    buttons.append(this.claim, this.claimAd);
    this.modal.body.append(lead, this.coins, this.note, buttons);
  }

  show(view: WelcomeView): void {
    this.away.textContent = view.away;
    this.coins.textContent = `💰 ${formatNumber(view.coins)}`;
    this.note.textContent = view.note;
    this.claim.textContent = 'Забрать';
    this.claimAd.textContent = `📺 Реклама → ×2 (💰 ${formatNumber(view.coins * 2)})`;
    this.setBusy(false);
  }

  /** Пока идёт реклама, кнопки не нажимаются. */
  setBusy(busy: boolean): void {
    this.claim.disabled = busy;
    this.claimAd.disabled = busy;
    this.claimAd.classList.toggle('disabled', busy);
  }
}
