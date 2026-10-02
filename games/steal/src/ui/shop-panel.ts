import { t } from '../i18n';
import { button, element } from './dom';
import { Modal } from './modal';

export interface ShopCardView {
  readonly id: string;
  readonly icon: string;
  readonly name: string;
  readonly description: string;
  /** Что игрок получит прямо сейчас (у сундука — «💰 1,2M»), или пусто. */
  readonly detail: string;
  /** Цена числом из каталога площадки. */
  readonly price: string;
  /** Значок валюты из каталога (по правилам площадки — рядом с ценой) или null — тогда валюта словом. */
  readonly currencyImage: string | null;
  /** Постоянный товар уже куплен. */
  readonly owned: boolean;
}

export interface ShopView {
  /** Каталог ещё грузится, готов или недоступен. */
  readonly state: 'loading' | 'ready' | 'unavailable';
  readonly cards: readonly ShopCardView[];
  /** Идёт оплата: кнопки не нажимаются. */
  readonly busy: boolean;
}

/** Окно «Магазин»: товары за Яны с фиксированным содержимым. */
export class ShopPanel {
  readonly modal: Modal;
  private readonly status: HTMLDivElement;
  private readonly list: HTMLDivElement;
  private readonly onBuy: (id: string) => void;
  private lastKey = '';

  constructor(container: HTMLElement, onBuy: (id: string) => void, onClose: () => void) {
    this.modal = new Modal(container, t.shop.title, onClose, 'shop-panel');
    this.onBuy = onBuy;
    this.status = element('div', 'shop-status');
    this.list = element('div', 'shop-list');
    this.modal.body.append(
      this.status,
      this.list,
      element('div', 'modal-hint', t.shop.hint),
    );
  }

  render(view: ShopView): void {
    const key = `${view.state}|${view.busy}|${view.cards.map((c) => `${c.id}${c.owned}${c.price}${c.detail}${c.currencyImage}`).join(',')}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const status = view.state === 'loading' ? t.shop.loading : view.state === 'unavailable' ? t.shop.closed : '';
    this.status.textContent = status;
    this.status.hidden = status === '';
    this.list.replaceChildren(...view.cards.map((card) => this.card(card, view.busy)));
  }

  private card(view: ShopCardView, busy: boolean): HTMLDivElement {
    const card = element('div', view.owned ? 'shop-card owned' : 'shop-card');
    const text = element('div', 'shop-text');
    text.append(element('div', 'shop-name', view.name), element('div', 'shop-description', view.description));
    if (view.detail) text.append(element('div', 'shop-detail', view.detail));
    card.append(element('span', 'shop-icon', view.icon), text, view.owned ? element('span', 'shop-owned', t.shop.owned) : this.priceButton(view, busy));
    return card;
  }

  private priceButton(view: ShopCardView, busy: boolean): HTMLButtonElement {
    const buy = button(busy ? 'buy-button shop-buy disabled' : 'buy-button shop-buy', '', () => {
      if (!busy) this.onBuy(view.id);
    });
    buy.disabled = busy;
    buy.append(element('span', 'shop-price', view.price));
    if (view.currencyImage) {
      const icon = element('img', 'shop-currency');
      icon.src = view.currencyImage;
      icon.alt = t.shop.currency;
      buy.append(icon);
    } else {
      buy.append(element('span', 'shop-currency-name', t.shop.currency));
    }
    return buy;
  }
}
