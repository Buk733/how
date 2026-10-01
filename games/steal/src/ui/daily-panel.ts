import { button, element, formatWait } from './dom';
import { Modal } from './modal';

/** Клетка календаря: забрана, сегодняшняя (можно забрать) или впереди. */
export interface DailyCellView {
  readonly day: number;
  readonly icon: string;
  readonly label: string;
  /** «💰 1 234» для монет, иначе пусто. */
  readonly amount: string;
  readonly state: 'claimed' | 'today' | 'future';
}

export interface DailyView {
  readonly cells: readonly DailyCellView[];
  readonly available: boolean;
  /** Какой день серии сегодня. */
  readonly streak: number;
  /** Через сколько мс следующая награда (когда сегодняшняя уже забрана). */
  readonly nextIn: number;
}

/** Окно «Награды за вход»: календарь на 7 дней, сегодняшняя клетка подсвечена. */
export class DailyPanel {
  readonly modal: Modal;
  private readonly grid: HTMLDivElement;
  private readonly streak: HTMLDivElement;
  private readonly claim: HTMLButtonElement;
  private readonly wait: HTMLDivElement;
  private lastKey = '';

  constructor(container: HTMLElement, onClaim: () => void, onClose: () => void) {
    this.modal = new Modal(container, '📅 Награды за вход', onClose, 'daily-panel');
    this.grid = element('div', 'daily-grid');
    this.streak = element('div', 'daily-streak');
    this.claim = button('buy-button free daily-claim', 'Забрать', onClaim);
    this.wait = element('div', 'daily-wait');
    this.modal.body.append(
      this.streak,
      this.grid,
      this.claim,
      this.wait,
      element('div', 'modal-hint', 'Заходи каждый день подряд — к седьмому дню награды всё лучше. Пропустишь день — серия начнётся заново.'),
    );
  }

  render(view: DailyView): void {
    const key = `${view.available}|${view.streak}|${view.cells.map((c) => `${c.state}${c.amount}`).join(',')}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      this.grid.replaceChildren(...view.cells.map((cell) => this.cell(cell)));
      this.streak.textContent = `Серия: ${view.streak} ${daysWord(view.streak)} подряд`;
      this.claim.hidden = !view.available;
    }
    const wait = view.available ? '' : `Следующая награда через ${formatWait(view.nextIn)}`;
    if (this.wait.textContent !== wait) this.wait.textContent = wait;
  }

  private cell(view: DailyCellView): HTMLDivElement {
    const cell = element('div', `daily-cell ${view.state}${view.day === 7 ? ' big' : ''}`);
    cell.append(
      element('span', 'daily-day', `День ${view.day}`),
      element('span', 'daily-icon', view.state === 'claimed' ? '✓' : view.icon),
      element('span', 'daily-label', view.label),
    );
    if (view.amount) cell.append(element('span', 'daily-amount', view.amount));
    return cell;
  }
}

/** «1 день», «3 дня», «5 дней». */
function daysWord(n: number): string {
  const tens = n % 100;
  const ones = n % 10;
  if (tens >= 11 && tens <= 14) return 'дней';
  if (ones === 1) return 'день';
  if (ones >= 2 && ones <= 4) return 'дня';
  return 'дней';
}
