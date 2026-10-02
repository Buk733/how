import { t } from '../i18n';
import { element } from './dom';
import { Modal } from './modal';

/** Карточка героя в окне выбора. */
export interface HeroCardView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Лист героя: 4 × 4 кадра 24×24, первый ряд — лицом к камере. */
  readonly sheetUrl: string;
  readonly selected: boolean;
}

/** Размер кадра героя на листе, пиксели. */
const HERO_FRAME = 24;

/**
 * Герой с листа, увеличенный без сглаживания: первый кадр ряда «лицом к камере».
 * walking — шагает на месте (CSS перебирает 4 кадра ряда).
 */
export function heroIcon(sheetUrl: string, size: number, walking = false): HTMLSpanElement {
  const icon = element('span', walking ? 'sprite-icon hero-icon walking' : 'sprite-icon hero-icon');
  icon.style.backgroundImage = `url("${sheetUrl}")`;
  icon.style.width = `${size}px`;
  icon.style.height = `${size}px`;
  icon.style.backgroundSize = `${size * 4}px ${size * 4}px`;
  icon.style.setProperty('--walk-width', `${-size * 4}px`);
  return icon;
}

/** Окно «Герой»: кем бегать по миру. Смена бесплатная и сразу. */
export class HeroPanel {
  readonly modal: Modal;
  private readonly list: HTMLDivElement;
  private lastKey = '';

  constructor(container: HTMLElement, onPick: (id: string) => void, onClose: () => void) {
    this.modal = new Modal(container, t.heroes.title, onClose, 'hero-panel');
    this.list = element('div', 'hero-list');
    this.list.addEventListener('click', (event) => {
      const card = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
      if (card?.dataset.id) onPick(card.dataset.id);
    });
    this.modal.body.append(this.list, element('div', 'modal-hint', t.heroes.hint));
  }

  render(cards: readonly HeroCardView[]): void {
    const key = cards.map((c) => `${c.id}:${c.selected}`).join('|');
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.list.replaceChildren(...cards.map((card) => this.card(card)));
  }

  private card(view: HeroCardView): HTMLButtonElement {
    const card = element('button', view.selected ? 'hero-card selected' : 'hero-card');
    card.type = 'button';
    card.dataset.id = view.id;
    card.append(
      heroIcon(view.sheetUrl, HERO_FRAME * 4, view.selected),
      element('span', 'hero-name', view.name),
      element('span', 'hero-description', view.description),
      element('span', 'hero-status', view.selected ? t.heroes.selected : t.heroes.select),
    );
    return card;
  }
}
