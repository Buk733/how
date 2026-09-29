import { formatNumber } from '@engine/format';
import { button, element, formatChance, formatWait, spriteIcon } from './dom';
import { Modal } from './modal';

/** Карточка кейса в магазине. */
export interface CaseCardView {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly color: string;
  readonly price: number;
  /** Шансы по редкостям. */
  readonly rarities: readonly { readonly name: string; readonly color: string; readonly chance: number }[];
  /** Шанс «Голды». */
  readonly gold: number;
  /** Состав: каждый персонаж и его шанс. */
  readonly contents: readonly { readonly name: string; readonly sprite: string; readonly color: string; readonly chance: number }[];
  /** Чем можно открыть прямо сейчас (null — нечем). */
  readonly payment: 'free' | 'key' | 'coins' | null;
  readonly keys: number;
  /** Для бесплатного кейса — через сколько мс снова бесплатно; null — кейс платный. */
  readonly freeIn: number | null;
  /** Особая пометка, например «первый кейс — точно редкий». */
  readonly note: string;
}

/** Персонаж на ленте открытия. */
export interface ReelItem {
  readonly name: string;
  readonly sprite: string;
  readonly color: string;
  readonly gold: boolean;
}

export interface CaseResultView {
  readonly title: string;
  readonly detail: string;
  readonly color: string;
  readonly gold: boolean;
}

export interface CasePanelCallbacks {
  onOpen(caseId: string): void;
  onClose(): void;
  /** Лента прокрутила очередную карточку — щелчок. */
  onTick(): void;
}

const CARD_WIDTH = 84;
const CARD_STEP = 90;
const SPIN_MS = 4600;

/** Окно кейсов: витрина с шансами и открытие с прокруткой ленты, как в CS:GO. */
export class CasePanel {
  readonly modal: Modal;
  private readonly callbacks: CasePanelCallbacks;
  private readonly shop: HTMLDivElement;
  private readonly opening: HTMLDivElement;
  private readonly reel: HTMLDivElement;
  private readonly strip: HTMLDivElement;
  private readonly result: HTMLDivElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly waits = new Map<string, HTMLDivElement>();
  private readonly notes = new Map<string, HTMLDivElement>();
  private built = false;
  private frame = 0;
  private lastCaseId = '';

  constructor(container: HTMLElement, callbacks: CasePanelCallbacks) {
    this.callbacks = callbacks;
    this.modal = new Modal(container, '🎁 Кейсы', () => callbacks.onClose(), 'case-panel');
    this.shop = element('div', 'case-shop');
    this.opening = element('div', 'case-opening');
    this.opening.hidden = true;
    this.reel = element('div', 'reel');
    this.strip = element('div', 'reel-strip');
    this.reel.append(this.strip, element('div', 'reel-marker'));
    this.result = element('div', 'case-result');
    this.opening.append(this.reel, this.result);
    this.modal.body.append(this.shop, this.opening, element('div', 'modal-hint', 'Кейсы — только за монеты. Шансы всегда на виду.'));
  }

  /** Идёт ли прокрутка ленты. */
  get spinning(): boolean {
    return this.frame !== 0;
  }

  /** Витрина: карточки строятся один раз, дальше обновляются только кнопки и таймер. */
  render(cards: readonly CaseCardView[]): void {
    if (!this.built) this.build(cards);
    for (const card of cards) {
      const buy = this.buttons.get(card.id);
      const wait = this.waits.get(card.id);
      const note = this.notes.get(card.id);
      if (!buy || !wait || !note) continue;
      const text =
        card.payment === 'free'
          ? '🎁 Открыть бесплатно'
          : card.payment === 'key'
            ? `🔑 Открыть ключом (${card.keys})`
            : `💰 ${formatNumber(card.price)}`;
      if (buy.textContent !== text) buy.textContent = text;
      buy.classList.toggle('disabled', card.payment === null);
      buy.classList.toggle('free', card.payment === 'free' || card.payment === 'key');
      const waitText = card.freeIn !== null && card.freeIn > 0 ? `Бесплатно через ${formatWait(card.freeIn)}` : '';
      if (wait.textContent !== waitText) wait.textContent = waitText;
      if (note.textContent !== card.note) note.textContent = card.note;
    }
  }

  /** Показывает витрину (после открытия или при входе). */
  showShop(): void {
    this.stop();
    this.opening.hidden = true;
    this.shop.hidden = false;
  }

  /**
   * Прокрутка ленты: strip — карточки, winner — номер выпавшей.
   * resolve вызывается, когда лента остановилась: выдаёт награду и говорит, что написать.
   */
  showOpening(caseId: string, strip: readonly ReelItem[], winner: number, resolve: () => CaseResultView): void {
    this.stop();
    this.lastCaseId = caseId;
    this.shop.hidden = true;
    this.opening.hidden = false;
    this.result.replaceChildren();
    this.strip.replaceChildren(...strip.map((item) => this.reelCard(item)));
    const view = this.reel.clientWidth || 360;
    const centerOf = (index: number) => view / 2 - (index * CARD_STEP + CARD_WIDTH / 2);
    const from = centerOf(2);
    const to = centerOf(winner) + (Math.random() - 0.5) * CARD_WIDTH * 0.7;
    const start = performance.now();
    let lastIndex = -1;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / SPIN_MS);
      const eased = 1 - (1 - t) ** 4;
      const x = from + (to - from) * eased;
      this.strip.style.transform = `translateX(${x.toFixed(1)}px)`;
      const index = Math.floor((view / 2 - x) / CARD_STEP);
      if (index !== lastIndex) {
        if (lastIndex >= 0) this.callbacks.onTick();
        lastIndex = index;
      }
      if (t < 1) {
        this.frame = requestAnimationFrame(step);
        return;
      }
      this.frame = 0;
      this.strip.children[winner]?.classList.add('winner');
      this.reveal(resolve());
    };
    this.frame = requestAnimationFrame(step);
  }

  /** Остановить прокрутку (окно закрыли). */
  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private reveal(result: CaseResultView): void {
    const title = element('div', 'case-result-title', result.title);
    title.style.color = result.color;
    const again = button('buy-button', 'Открыть ещё', () => this.callbacks.onOpen(this.lastCaseId));
    const back = button('plain-button', 'К кейсам', () => this.showShop());
    const buttons = element('div', 'case-result-buttons');
    buttons.append(again, back);
    this.result.replaceChildren(title, element('div', 'case-result-detail', result.detail), buttons);
    this.result.classList.toggle('gold', result.gold);
  }

  private build(cards: readonly CaseCardView[]): void {
    this.built = true;
    for (const card of cards) {
      const root = element('div', 'case-card');
      root.style.setProperty('--case-color', card.color);
      const head = element('div', 'case-head');
      const title = element('div', 'case-title');
      title.append(element('div', 'case-name', card.name), element('div', 'case-price', `💰 ${formatNumber(card.price)}`));
      head.append(element('div', 'case-icon', card.icon), title);

      const odds = element('div', 'case-odds');
      for (const r of card.rarities) {
        const chip = element('span', 'odds-chip', `${r.name} ${formatChance(r.chance)}`);
        chip.style.color = r.color;
        odds.append(chip);
      }
      const gold = element('span', 'odds-chip gold', `✨ Голда ${formatChance(card.gold)}`);
      odds.append(gold);

      const contents = element('details', 'case-contents');
      contents.append(element('summary', '', 'Состав и шансы'));
      const list = element('div', 'contents-list');
      for (const item of card.contents) {
        const row = element('div', 'contents-row');
        const name = element('span', 'contents-name', item.name);
        name.style.color = item.color;
        row.append(spriteIcon(item.sprite, 32), name, element('span', 'contents-chance', formatChance(item.chance)));
        list.append(row);
      }
      contents.append(list);

      const buy = button('buy-button', '', () => this.callbacks.onOpen(card.id));
      const wait = element('div', 'case-wait');
      const note = element('div', 'case-note');
      this.buttons.set(card.id, buy);
      this.waits.set(card.id, wait);
      this.notes.set(card.id, note);
      root.append(head, odds, contents, note, buy, wait);
      this.shop.append(root);
    }
  }

  private reelCard(item: ReelItem): HTMLDivElement {
    const card = element('div', item.gold ? 'reel-card gold' : 'reel-card');
    card.style.setProperty('--rarity', item.color);
    card.append(spriteIcon(item.sprite, 56), element('div', 'reel-name', item.name));
    return card;
  }
}
