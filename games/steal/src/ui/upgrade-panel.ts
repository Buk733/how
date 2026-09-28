import { formatNumber } from '@engine/format';
import { element } from './hud';

/** Одна строка панели прокачки. */
export interface UpgradeRowView {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly level: number;
  readonly maxLevel: number;
  /** Что даёт текущий уровень и что даст следующий (null — прокачано до конца). */
  readonly now: string;
  readonly next: string | null;
  readonly cost: number | null;
  readonly affordable: boolean;
}

/** Окно «Прокачка»: кроссовки, веник, щеколда, печь. Игра при этом не останавливается. */
export class UpgradePanel {
  private readonly root: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private lastKey = '';

  constructor(container: HTMLElement, onBuy: (id: string) => void, onClose: () => void) {
    this.root = element('div', 'upgrade-panel');
    this.root.hidden = true;
    // касания панели не должны запускать джойстик и удар мышью
    this.root.addEventListener('pointerdown', (event) => event.stopPropagation());

    const header = element('div', 'upgrade-header');
    const close = element('button', 'upgrade-close', '✕');
    close.type = 'button';
    close.title = 'Закрыть';
    close.addEventListener('click', () => onClose());
    header.append(element('span', 'upgrade-title', '⚡ Прокачка'), close);

    this.list = element('div', 'upgrade-list');
    this.list.addEventListener('click', (event) => {
      const buy = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (buy?.dataset.id) onBuy(buy.dataset.id);
    });

    this.root.append(header, this.list, element('div', 'upgrade-hint', 'Монеты тратятся сразу, прокачка остаётся навсегда'));
    container.append(this.root);
  }

  get isOpen(): boolean {
    return !this.root.hidden;
  }

  setOpen(open: boolean): void {
    this.root.hidden = !open;
  }

  /** Перерисовывает строки, только если что-то поменялось (уровень или хватает ли монет). */
  render(rows: readonly UpgradeRowView[]): void {
    const key = rows.map((r) => `${r.id}:${r.level}:${r.affordable}`).join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.list.replaceChildren(...rows.map((row) => this.row(row)));
  }

  private row(view: UpgradeRowView): HTMLDivElement {
    const row = element('div', 'upgrade-row');
    const info = element('div', 'upgrade-info');
    const name = element('div', 'upgrade-name', `${view.name} `);
    name.append(element('span', 'upgrade-level', '●'.repeat(view.level) + '○'.repeat(view.maxLevel - view.level)));
    info.append(name, element('div', 'upgrade-now', view.now));
    if (view.next) info.append(element('div', 'upgrade-next', `→ ${view.next}`));

    let buy: HTMLElement;
    if (view.cost === null) {
      buy = element('div', 'upgrade-max', 'МАКС');
    } else {
      const button = element('button', 'upgrade-buy', `💰 ${formatNumber(view.cost)}`);
      button.type = 'button';
      button.dataset.id = view.id;
      button.classList.toggle('disabled', !view.affordable);
      buy = button;
    }
    row.append(element('div', 'upgrade-icon', view.icon), info, buy);
    return row;
  }
}
