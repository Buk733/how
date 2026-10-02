import { formatNumber } from '@engine/format';
import { t } from '../i18n';
import { button, element } from './dom';
import { Modal } from './modal';

export interface RebirthView {
  readonly rebirths: number;
  /** «×1,5» — доход сейчас и после перерождения. */
  readonly multiplier: string;
  readonly nextMultiplier: string;
  readonly cost: number;
  readonly coins: number;
  /** Почему сейчас нельзя (несёшь добычу, идёт набег) или null. */
  readonly blocked: string | null;
}

/** Сколько секунд кнопка ждёт второго нажатия «Точно?». */
const CONFIRM_SECONDS = 4;

/** Окно «Перерождение»: что сбросится, что останется, сколько нужно монет. Нажать — дважды. */
export class RebirthPanel {
  readonly modal: Modal;
  private readonly now: HTMLDivElement;
  private readonly next: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly barText: HTMLDivElement;
  private readonly action: HTMLButtonElement;
  private readonly blocked: HTMLDivElement;
  private confirmUntil = 0;
  private ready = false;

  constructor(container: HTMLElement, onRebirth: () => void, onClose: () => void) {
    this.modal = new Modal(container, t.rebirth.title, onClose, 'rebirth-panel');
    this.now = element('div', 'rebirth-now');
    this.next = element('div', 'rebirth-next');
    const lists = element('div', 'rebirth-lists');
    lists.append(
      this.list(t.rebirth.reset, t.rebirth.resetItems, 'reset'),
      this.list(t.rebirth.keep, t.rebirth.keepItems, 'keep'),
    );
    const progress = element('div', 'rebirth-progress');
    this.bar = element('div', 'rebirth-bar');
    this.barText = element('div', 'rebirth-bar-text');
    progress.append(this.bar, this.barText);
    this.action = button('buy-button rebirth-button', '', () => {
      if (!this.ready) return;
      if (performance.now() < this.confirmUntil) {
        this.confirmUntil = 0;
        onRebirth();
      } else {
        this.confirmUntil = performance.now() + CONFIRM_SECONDS * 1000;
      }
    });
    this.blocked = element('div', 'rebirth-blocked');
    this.modal.body.append(this.now, this.next, lists, progress, this.action, this.blocked);
  }

  render(view: RebirthView): void {
    this.setText(this.now, view.rebirths > 0 ? t.rebirth.now(view.multiplier, view.rebirths) : t.rebirth.never);
    this.setText(this.next, t.rebirth.next(view.nextMultiplier));
    const share = Math.min(1, view.coins / view.cost);
    this.bar.style.setProperty('--progress', String(share));
    this.setText(this.barText, `💰 ${formatNumber(Math.floor(Math.min(view.coins, view.cost)))} / ${formatNumber(view.cost)}`);
    this.ready = share >= 1 && view.blocked === null;
    const confirming = this.ready && performance.now() < this.confirmUntil;
    this.setText(this.action, confirming ? t.rebirth.confirm : t.rebirth.action(formatNumber(view.cost)));
    this.action.classList.toggle('disabled', !this.ready);
    this.action.classList.toggle('confirm', confirming);
    this.setText(this.blocked, view.blocked ?? '');
  }

  /** Окно закрыли — подтверждение сбрасывается. */
  resetConfirm(): void {
    this.confirmUntil = 0;
  }

  private list(title: string, items: readonly string[], kind: 'reset' | 'keep'): HTMLDivElement {
    const box = element('div', `rebirth-list ${kind}`);
    box.append(element('div', 'rebirth-list-title', title), ...items.map((item) => element('div', 'rebirth-item', item)));
    return box;
  }

  private setText(el: HTMLElement, text: string): void {
    if (el.textContent !== text) el.textContent = text;
  }
}
