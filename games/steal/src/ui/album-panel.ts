import { element, spriteIcon } from './dom';
import { Modal } from './modal';

export interface AlbumCardView {
  readonly name: string;
  readonly color: string;
  /** Картинка карточки: обычная, а если получена только «Голда» — золотая. */
  readonly sprite: string;
  readonly found: boolean;
  readonly gold: boolean;
}

export interface AlbumSecretView {
  readonly name: string;
  /** Где искать — показывается, пока пасхалка не найдена. */
  readonly hint: string;
  readonly found: boolean;
}

export interface AlbumView {
  readonly found: number;
  readonly gold: number;
  readonly total: number;
  readonly cards: readonly AlbumCardView[];
  readonly secrets: readonly AlbumSecretView[];
}

/** Окно «Альбом»: все персонажи (кого ещё не было — силуэтом), их «Голда» и пасхалки. */
export class AlbumPanel {
  readonly modal: Modal;
  private readonly summary: HTMLDivElement;
  private readonly cards: HTMLDivElement;
  private readonly secretsTitle: HTMLDivElement;
  private readonly secrets: HTMLDivElement;
  private lastKey = '';

  constructor(container: HTMLElement, onClose: () => void) {
    this.modal = new Modal(container, '📖 Альбом', onClose, 'album-panel');
    this.summary = element('div', 'album-summary');
    this.cards = element('div', 'album-cards');
    this.secretsTitle = element('div', 'modal-subtitle');
    this.secrets = element('div', 'album-secrets');
    this.modal.body.append(
      this.summary,
      this.cards,
      this.secretsTitle,
      this.secrets,
      element('div', 'modal-hint', 'Альбом остаётся навсегда — даже после перерождения'),
    );
  }

  render(view: AlbumView): void {
    const key = `${view.cards.map((c) => `${c.found}${c.gold}`).join('')}|${view.secrets.map((s) => s.found).join('')}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const foundSecrets = view.secrets.filter((s) => s.found).length;
    this.summary.textContent = `Персонажи ${view.found}/${view.total} · «Голда» ${view.gold}/${view.total} · Пасхалки ${foundSecrets}/${view.secrets.length}`;
    this.cards.replaceChildren(...view.cards.map((card) => this.card(card)));
    this.secretsTitle.textContent = `🔍 Пасхалки ${foundSecrets}/${view.secrets.length}`;
    this.secrets.replaceChildren(
      ...view.secrets.map((s) => element('div', s.found ? 'album-secret found' : 'album-secret', s.found ? `✓ ${s.name}` : `??? — ${s.hint}`)),
    );
  }

  private card(view: AlbumCardView): HTMLDivElement {
    const card = element('div', view.found ? 'album-card' : 'album-card unknown');
    card.style.setProperty('--card-color', view.color);
    card.append(
      spriteIcon(view.sprite, 56),
      element('span', 'album-name', view.found ? view.name : '???'),
      element('span', view.gold ? 'album-gold got' : 'album-gold', view.gold ? '★ Голда' : '☆ Голда'),
    );
    return card;
  }
}
