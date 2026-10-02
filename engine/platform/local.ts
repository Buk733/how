import {
  browserStorage,
  readJson,
  writeJson,
  type DemoProduct,
  type DemoTexts,
  type Leaderboard,
  type LeaderboardEntry,
  type LeaderboardTable,
  type Payments,
  type Platform,
  type PlatformOptions,
  type SaveCopies,
  type ShopProduct,
  type ShopPurchase,
  type StorageLike,
} from './platform';

export interface LocalPlatformOptions {
  /**
   * Сколько мс вместо рекламы, оплаты и входа висит табличка «Здесь будет…» (демо-сборка);
   * 0 — всё «проходит» мгновенно (разработка, тесты).
   */
  readonly previewMs?: number;
  /** Хранилище вместо localStorage (тесты). */
  readonly storage?: StorageLike | null;
}

/** Таблички по умолчанию, если игра не дала свои. */
const DEFAULT_TEXTS: DemoTexts = {
  fullscreenAd: '📺 Здесь будет полноэкранная реклама',
  rewardedAd: '📺 Здесь будет реклама за награду\nВ демо вместо ролика — эта табличка',
  login: '🔑 Здесь будет вход в аккаунт Яндекса',
  payment: '💳 Здесь будет оплата Янами\nВ демо покупка бесплатная',
};

/**
 * Заглушка площадки для разработки и демо: сохранения в localStorage, вместо рекламы, оплаты и входа —
 * табличка или ничего. Покупки бесплатные, таблица рекордов — пример с выдуманными игроками.
 */
export class LocalPlatform implements Platform {
  readonly kind = 'local';
  readonly language = (globalThis.navigator?.language || 'ru').slice(0, 2);
  readonly minSaveInterval = 1000;
  readonly payments: Payments | null;
  readonly leaderboard: Leaderboard | null;
  private readonly storage: StorageLike | null;
  private readonly storageKey: string;
  private readonly previewMs: number;
  private readonly texts: () => DemoTexts;
  private authorized = false;

  constructor(options: PlatformOptions, local: LocalPlatformOptions = {}) {
    this.storageKey = options.storageKey;
    this.storage = local.storage === undefined ? browserStorage() : local.storage;
    this.previewMs = local.previewMs ?? 0;
    this.texts = options.demoTexts ?? (() => DEFAULT_TEXTS);
    const payment = () => this.preview(this.texts().payment);
    this.payments = options.demoCatalog ? new LocalShop(options.demoCatalog, this.storage, `${options.storageKey}.purchases`, payment) : null;
    this.leaderboard = options.leaderboard ? new SampleRecords(() => this.authorized) : null;
  }

  ready(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}

  async loadData(): Promise<SaveCopies> {
    return { cloud: null, local: readJson(this.storage, this.storageKey) };
  }

  async saveData(data: unknown): Promise<void> {
    writeJson(this.storage, this.storageKey, data);
  }

  async showFullscreenAd(): Promise<void> {
    console.info('[реклама] полноэкранная (заглушка)');
    await this.preview(this.texts().fullscreenAd);
  }

  async showRewardedAd(): Promise<boolean> {
    console.info('[реклама] за вознаграждение (заглушка) — награда выдана');
    await this.preview(this.texts().rewardedAd);
    return true;
  }

  setBannerVisible(): void {}
  onPause(): void {}
  onResume(): void {}

  isAuthorized(): boolean {
    return this.authorized;
  }

  async openAuth(): Promise<boolean> {
    await this.preview(this.texts().login);
    this.authorized = true;
    return true;
  }

  /** Табличка на месте рекламы, оплаты или входа: видно, где игрок увидит окно площадки. */
  private async preview(text: string): Promise<void> {
    if (this.previewMs <= 0) return;
    const overlay = document.createElement('div');
    overlay.textContent = text;
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '1000',
      display: 'grid',
      placeItems: 'center',
      padding: '24px',
      background: 'rgb(10 12 20 / 0.86)',
      color: '#f4f4f4',
      font: '800 22px system-ui, sans-serif',
      textAlign: 'center',
      whiteSpace: 'pre-line',
    });
    document.body.append(overlay);
    await new Promise((resolve) => window.setTimeout(resolve, this.previewMs));
    overlay.remove();
  }
}

/** Покупки в демо: бесплатно, а необработанные и постоянные хранятся в localStorage, как на площадке. */
class LocalShop implements Payments {
  private readonly catalog: readonly DemoProduct[];
  private readonly storage: StorageLike | null;
  private readonly key: string;
  /** Табличка «Здесь будет оплата». */
  private readonly preview: () => Promise<void>;

  constructor(catalog: readonly DemoProduct[], storage: StorageLike | null, key: string, preview: () => Promise<void>) {
    this.catalog = catalog;
    this.storage = storage;
    this.key = key;
    this.preview = preview;
  }

  async getCatalog(): Promise<ShopProduct[]> {
    return this.catalog.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      priceValue: String(p.price),
      currencyCode: 'YAN',
      currencyImage: null,
    }));
  }

  async purchase(productId: string): Promise<ShopPurchase | null> {
    if (!this.catalog.some((p) => p.id === productId)) return null;
    await this.preview();
    const purchase = { productId, token: `demo-${Date.now()}-${Math.floor(Math.random() * 1e9)}` };
    this.write([...this.read(), purchase]);
    return purchase;
  }

  async getPurchases(): Promise<ShopPurchase[]> {
    return this.read();
  }

  async consume(token: string): Promise<void> {
    this.write(this.read().filter((p) => p.token !== token));
  }

  private read(): ShopPurchase[] {
    const list = readJson(this.storage, this.key);
    return Array.isArray(list)
      ? list.filter((p): p is ShopPurchase => typeof p?.productId === 'string' && typeof p?.token === 'string')
      : [];
  }

  private write(list: readonly ShopPurchase[]): void {
    writeJson(this.storage, this.key, list);
  }
}

/** Выдуманные соседи по таблице (ники латиницей — подходят к любому языку): в демо видно, как выглядит рейтинг. */
const SAMPLE: readonly (readonly [string, number])[] = [
  ['Timur', 2_400_000],
  ['ParMaster', 1_150_000],
  ['Lyuba_Banya', 640_000],
  ['Zhorik', 310_000],
  ['Venichek', 150_000],
  ['KotKotost', 72_000],
  ['HamamAga', 31_000],
  ['Shaika', 12_500],
  ['Kovshik', 4_800],
  ['Newbie', 900],
];

/** Таблица рекордов в демо: пример, куда встаёт и сам игрок, если вошёл и прислал результат. */
class SampleRecords implements Leaderboard {
  private readonly authorized: () => boolean;
  private best = 0;

  constructor(authorized: () => boolean) {
    this.authorized = authorized;
  }

  async setScore(score: number): Promise<void> {
    if (!this.authorized()) throw new Error('Рекорды — только для вошедших');
    this.best = Math.max(this.best, Math.floor(score));
  }

  async getTable(): Promise<LeaderboardTable> {
    const rows: { name: string; score: number; isPlayer: boolean }[] = SAMPLE.map(([name, score]) => ({ name, score, isPlayer: false }));
    if (this.authorized() && this.best > 0) rows.push({ name: '', score: this.best, isPlayer: true });
    rows.sort((a, b) => b.score - a.score);
    const entries: LeaderboardEntry[] = rows.map((row, i) => ({ ...row, rank: i + 1, avatar: null }));
    return { entries, player: entries.find((e) => e.isPlayer) ?? null, sample: true };
  }
}
