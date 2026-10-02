import { formatNumber } from '@engine/format';
import { t } from '../i18n';
import { element } from './dom';
import { Modal } from './modal';

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

/** Окно «Прокачка»: кроссовки, веник, щеколда, печь. */
export class UpgradePanel {
  readonly modal: Modal;
  private readonly list: HTMLDivElement;
  private readonly note: HTMLDivElement;
  private lastKey = '';

  constructor(container: HTMLElement, onBuy: (id: string) => void, onClose: () => void) {
    this.modal = new Modal(container, t.upgrades.title, onClose, 'upgrade-panel');
    this.list = element('div', 'upgrade-list');
    this.list.addEventListener('click', (event) => {
      const buy = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (buy?.dataset.id) onBuy(buy.dataset.id);
    });
    this.note = element('div', 'upgrade-note');
    this.modal.body.append(this.list, this.note, element('div', 'modal-hint', t.upgrades.hint));
  }

  /** Строка под списком: какого уровня сейчас соседи. */
  setNote(text: string): void {
    if (this.note.textContent !== text) this.note.textContent = text;
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
      buy = element('div', 'upgrade-max', t.upgrades.max);
    } else {
      const button = element('button', 'buy-button', `💰 ${formatNumber(view.cost)}`);
      button.type = 'button';
      button.dataset.id = view.id;
      button.classList.toggle('disabled', !view.affordable);
      buy = button;
    }
    row.append(element('div', 'upgrade-icon', view.icon), info, buy);
    return row;
  }
}
