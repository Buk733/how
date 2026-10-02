import { formatNumber } from '@engine/format';
import type { LeaderboardEntry, LeaderboardTable, Platform, ShopProduct } from '@engine/platform/platform';
import type { GameContext } from './context';
import { COIN_CHEST, PRODUCTS, productById, type ProductId } from './data/shop';
import { t } from './i18n';
import { chestCoins, owns } from './shop';
import { LeaderboardPanel, type LeaderboardView } from './ui/leaderboard-panel';
import type { Modal } from './ui/modal';
import { ShopPanel, type ShopView } from './ui/shop-panel';

/** Окна площадки: магазин за Яны и рейтинг. */
export type ShopMenuId = 'shop' | 'leaderboard';

/** Что окна магазина и рейтинга просят у игры. */
export interface ShopActions {
  /** Оплатить товар и выдать его; промис завершается, когда всё закончилось (или игрок передумал). */
  buyProduct(id: ProductId): Promise<void>;
  /** Окно входа площадки; промис завершается, когда вход закончился. */
  login(): Promise<void>;
}

/** Что окнам нужно от площадки. */
export type ShopPlatform = Pick<Platform, 'payments' | 'leaderboard' | 'isAuthorized'>;

/** Данные с площадки: ещё не просили, грузятся, готовы или недоступны. */
type Remote<T> = { readonly state: 'idle' | 'loading' | 'unavailable' } | { readonly state: 'ready'; readonly value: T };

/**
 * Магазин и рейтинг. Каталог грузится один раз (цены и значок валюты — из каталога площадки),
 * таблица — при каждом открытии окна. Открывает и закрывает их Menus.
 */
export class ShopMenus {
  readonly modals: Readonly<Record<ShopMenuId, Modal>>;
  private readonly ctx: GameContext;
  private readonly platform: ShopPlatform;
  private readonly actions: ShopActions;
  private readonly shop: ShopPanel;
  private readonly board: LeaderboardPanel;
  private catalog: Remote<ShopProduct[]> = { state: 'idle' };
  private table: Remote<LeaderboardTable> = { state: 'idle' };
  /** Идёт оплата или вход. */
  private busy = false;

  constructor(container: HTMLElement, ctx: GameContext, platform: ShopPlatform, actions: ShopActions, close: () => void) {
    this.ctx = ctx;
    this.platform = platform;
    this.actions = actions;
    this.shop = new ShopPanel(container, (id) => void this.buy(id), close);
    this.board = new LeaderboardPanel(container, () => void this.login(), close);
    this.modals = { shop: this.shop.modal, leaderboard: this.board.modal };
  }

  /** Есть ли такое окно на этой площадке (иначе кнопку не показываем). */
  available(menu: ShopMenuId): boolean {
    return menu === 'shop' ? this.platform.payments !== null : this.platform.leaderboard !== null;
  }

  /** Окно открылось: каталог — если его ещё нет, таблица — всегда свежая. */
  opened(menu: ShopMenuId): void {
    if (menu === 'shop' && this.catalog.state !== 'ready' && this.catalog.state !== 'loading') void this.loadCatalog();
    if (menu === 'leaderboard') void this.loadTable();
  }

  refresh(menu: ShopMenuId): void {
    if (menu === 'shop') this.shop.render(this.shopView());
    else this.board.render(this.boardView());
  }

  // ---------------------------------------------------------------- магазин

  private shopView(): ShopView {
    const { catalog, busy } = this;
    if (catalog.state !== 'ready') return { state: catalog.state === 'unavailable' ? 'unavailable' : 'loading', cards: [], busy };
    const { save } = this.ctx;
    // показываем только то, что заведено в каталоге площадки, — в нашем порядке и с нашими названиями
    const cards = PRODUCTS.flatMap((def) => {
      const product = catalog.value.find((p) => p.id === def.id);
      if (!product) return [];
      return [
        {
          id: def.id,
          icon: def.icon,
          name: def.name,
          description: def.description,
          detail: def.id === COIN_CHEST ? t.shop.chestNow(formatNumber(chestCoins(save))) : '',
          price: product.priceValue,
          currencyImage: product.currencyImage,
          owned: def.kind === 'permanent' && owns(save, def.id),
        },
      ];
    });
    return { state: cards.length > 0 ? 'ready' : 'unavailable', cards, busy };
  }

  private async loadCatalog(): Promise<void> {
    const payments = this.platform.payments;
    if (!payments) {
      this.catalog = { state: 'unavailable' };
      return;
    }
    this.catalog = { state: 'loading' };
    try {
      this.catalog = { state: 'ready', value: await payments.getCatalog() };
    } catch (error) {
      console.warn('Каталог товаров не загрузился:', error);
      this.catalog = { state: 'unavailable' };
    }
  }

  private async buy(id: string): Promise<void> {
    const product = productById(id);
    if (this.busy || !product) return;
    this.busy = true;
    try {
      await this.actions.buyProduct(product.id);
    } finally {
      this.busy = false;
    }
  }

  // ---------------------------------------------------------------- рейтинг

  private boardView(): LeaderboardView {
    const { save } = this.ctx;
    const { table } = this;
    const ready = table.state === 'ready' ? table.value : null;
    return {
      state: ready ? 'ready' : table.state === 'unavailable' ? 'unavailable' : 'loading',
      rows: (ready?.entries ?? []).map((e) => ({ rank: e.rank, name: leaderName(e), score: t.leaderboard.score(formatNumber(e.score)), isPlayer: e.isPlayer })),
      best: t.leaderboard.best(formatNumber(save.stats.bestIncome)),
      guest: !this.platform.isAuthorized(),
      sample: ready?.sample === true,
      busy: this.busy,
    };
  }

  private async loadTable(): Promise<void> {
    const leaderboard = this.platform.leaderboard;
    if (!leaderboard) {
      this.table = { state: 'unavailable' };
      return;
    }
    if (this.table.state !== 'ready') this.table = { state: 'loading' };
    try {
      this.table = { state: 'ready', value: await leaderboard.getTable() };
    } catch (error) {
      console.warn('Рейтинг не загрузился:', error);
      if (this.table.state !== 'ready') this.table = { state: 'unavailable' };
    }
  }

  private async login(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.actions.login();
    } finally {
      this.busy = false;
    }
    await this.loadTable();
  }
}

/** Имя в таблице: сам игрок — «Ты» (в примере таблицы), скрывший имя — «Игрок скрыл имя». */
function leaderName(entry: LeaderboardEntry): string {
  if (entry.isPlayer && entry.name === '') return t.leaderboard.you;
  return entry.name === '' ? t.leaderboard.hiddenName : entry.name;
}
