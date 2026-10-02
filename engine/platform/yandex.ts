import {
  browserStorage,
  readJson,
  writeJson,
  type Leaderboard,
  type LeaderboardEntry,
  type LeaderboardTable,
  type Payments,
  type Platform,
  type PlatformOptions,
  type SaveCopies,
  type SaveOptions,
  type ShopProduct,
  type ShopPurchase,
  type StorageLike,
} from './platform';

// Минимальные типы Yandex Games SDK — только то, что использует игра.
// Документация: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
// Методы, которые в SDK появились позже или устарели, необязательные: адаптер работает с обоими вариантами.

interface AdCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown?: boolean) => void;
  onError?: (error: unknown) => void;
  onOffline?: () => void;
  onRewarded?: () => void;
}

interface YandexPlayer {
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  getUniqueID?(): string;
  isAuthorized?(): boolean;
  /** Устаревший способ узнать, вошёл ли игрок: 'lite' — гость. */
  getMode?(): string;
}

interface YandexProduct {
  id: string;
  title: string;
  description: string;
  price?: string;
  priceValue?: string;
  priceCurrencyCode?: string;
  getPriceCurrencyImage?(size: 'small' | 'medium' | 'svg'): string;
}

interface YandexPurchase {
  productID: string;
  purchaseToken: string;
}

interface YandexPayments {
  purchase(options: { id: string; developerPayload?: string }): Promise<YandexPurchase>;
  getPurchases(): Promise<YandexPurchase[]>;
  getCatalog(): Promise<YandexProduct[]>;
  consumePurchase(token: string): Promise<unknown>;
}

export interface YandexEntry {
  score: number;
  rank: number;
  player: {
    publicName?: string;
    uniqueID?: string;
    getAvatarSrc?(size: 'small' | 'medium' | 'large'): string;
  };
}

interface YandexEntries {
  entries: YandexEntry[];
}

interface EntriesOptions {
  quantityTop: number;
  includeUser: boolean;
  quantityAround: number;
}

/** Таблицы рекордов, новый API: ysdk.leaderboards. */
interface YandexLeaderboards {
  setScore(name: string, score: number): Promise<unknown>;
  getEntries(name: string, options: EntriesOptions): Promise<YandexEntries>;
}

/** Старый API: ysdk.getLeaderboards(). */
interface YandexLegacyLeaderboards {
  setLeaderboardScore(name: string, score: number): Promise<unknown>;
  getLeaderboardEntries(name: string, options: EntriesOptions): Promise<YandexEntries>;
}

export interface YandexSdk {
  environment: { i18n: { lang: string } };
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(options: { callbacks: AdCallbacks }): void;
    showRewardedVideo(options: { callbacks: AdCallbacks }): void;
    showBannerAdv?(): unknown;
    hideBannerAdv?(): unknown;
  };
  auth?: { openAuthDialog(): Promise<unknown> };
  getPlayer(options?: { scopes?: boolean; signed?: boolean }): Promise<YandexPlayer>;
  payments?: YandexPayments;
  getPayments?(options?: { signed?: boolean }): Promise<YandexPayments>;
  leaderboards?: YandexLeaderboards;
  getLeaderboards?(): Promise<YandexLegacyLeaderboards>;
  on(event: 'game_api_pause' | 'game_api_resume', listener: () => void): void;
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YandexSdk> };
  }
}

/** Зависимости для тестов: хранилище вместо localStorage. */
export interface YandexDeps {
  readonly storage?: StorageLike | null;
}

const SAVE_KEY = 'save';
/** setData — не чаще 100 раз за 5 минут: в облако — не чаще раза в 4 с, последние данные уходят позже. */
const CLOUD_INTERVAL_MS = 4000;
/** Сколько лучших показывать и сколько соседей по таблице вокруг игрока. */
const TOP = 10;
const AROUND = 2;

export class YandexPlatform implements Platform {
  readonly kind = 'yandex';
  readonly language: string;
  readonly minSaveInterval = 1000;
  readonly payments: Payments | null;
  readonly leaderboard: Leaderboard | null;
  private readonly sdk: YandexSdk;
  private player: YandexPlayer | null;
  private readonly storage: StorageLike | null;
  private readonly storageKey: string;
  private lastCloudSave = -Infinity;
  private cloudTimer: ReturnType<typeof setTimeout> | null = null;
  /** Данные, которые ещё не ушли в облако (undefined — всё отправлено). */
  private cloudPending: unknown = undefined;

  private constructor(sdk: YandexSdk, player: YandexPlayer | null, payments: YandexPayments | null, options: PlatformOptions, deps: YandexDeps) {
    this.sdk = sdk;
    this.player = player;
    this.storageKey = options.storageKey;
    this.storage = deps.storage === undefined ? browserStorage() : deps.storage;
    this.language = sdk.environment.i18n.lang;
    this.payments = payments ? new YandexShop(payments, () => this.refreshGuest()) : null;
    this.leaderboard = options.leaderboard ? new YandexRecords(sdk, options.leaderboard, () => this.player?.getUniqueID?.() ?? null) : null;
  }

  static async create(yaGames: { init(): Promise<YandexSdk> }, options: PlatformOptions, deps: YandexDeps = {}): Promise<YandexPlatform> {
    const sdk = await yaGames.init();
    let player: YandexPlayer | null = null;
    try {
      // сохранения работают и для гостей, без запроса доступа к профилю
      player = await sdk.getPlayer({ scopes: false });
    } catch (error) {
      console.warn('Не удалось получить игрока, сохраняем только локально:', error);
    }
    let payments: YandexPayments | null = sdk.payments ?? null;
    if (!payments && sdk.getPayments) {
      try {
        payments = await sdk.getPayments({ signed: false });
      } catch (error) {
        console.info('Покупки недоступны:', error);
      }
    }
    return new YandexPlatform(sdk, player, payments, options, deps);
  }

  ready(): void {
    this.sdk.features.LoadingAPI?.ready();
  }

  gameplayStart(): void {
    this.sdk.features.GameplayAPI?.start();
  }

  gameplayStop(): void {
    this.sdk.features.GameplayAPI?.stop();
  }

  async loadData(): Promise<SaveCopies> {
    let cloud: unknown = null;
    if (this.player) {
      try {
        cloud = (await this.player.getData([SAVE_KEY]))[SAVE_KEY] ?? null;
      } catch (error) {
        console.warn('Не удалось загрузить облачное сохранение:', error);
      }
    }
    return { cloud, local: readJson(this.storage, this.storageKey) };
  }

  async saveData(data: unknown, options: SaveOptions = {}): Promise<void> {
    writeJson(this.storage, this.storageKey, data);
    if (!this.player) return;
    this.cloudPending = data;
    if (options.flush) await this.sendToCloud(true);
    else this.scheduleCloud();
  }

  showFullscreenAd(): Promise<void> {
    return new Promise((resolve) => {
      this.sdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: () => resolve(),
          onError: (error) => {
            console.info('Полноэкранная реклама не показалась:', error);
            resolve();
          },
          onOffline: () => resolve(),
        },
      });
    });
  }

  showRewardedAd(): Promise<boolean> {
    return new Promise((resolve) => {
      let rewarded = false;
      this.sdk.adv.showRewardedVideo({
        callbacks: {
          // награду выдаём только после onRewarded — так требует площадка
          onRewarded: () => {
            rewarded = true;
          },
          onClose: () => resolve(rewarded),
          onError: (error) => {
            console.info('Реклама за награду не показалась:', error);
            resolve(false);
          },
        },
      });
    });
  }

  setBannerVisible(visible: boolean): void {
    try {
      if (visible) this.sdk.adv.showBannerAdv?.();
      else this.sdk.adv.hideBannerAdv?.();
    } catch (error) {
      console.info('Стики-баннер не переключился:', error);
    }
  }

  onPause(listener: () => void): void {
    this.sdk.on('game_api_pause', listener);
  }

  onResume(listener: () => void): void {
    this.sdk.on('game_api_resume', listener);
  }

  isAuthorized(): boolean {
    const player = this.player;
    if (!player) return false;
    if (player.isAuthorized) return player.isAuthorized();
    return player.getMode ? player.getMode() !== 'lite' : false;
  }

  async openAuth(): Promise<boolean> {
    if (!this.sdk.auth) return false;
    try {
      await this.sdk.auth.openAuthDialog();
    } catch {
      return false; // игрок закрыл окно входа
    }
    try {
      // вошедшего спрашиваем про имя и аватар — они видны в таблице рекордов
      this.player = await this.sdk.getPlayer({ scopes: true });
    } catch {
      try {
        this.player = await this.sdk.getPlayer({ scopes: false });
      } catch (error) {
        console.warn('Не удалось обновить игрока после входа:', error);
      }
    }
    return this.isAuthorized();
  }

  /** Гостя окно оплаты просит войти: после покупки берём игрока заново, чтобы сохранения шли в аккаунт. */
  private async refreshGuest(): Promise<void> {
    if (this.isAuthorized()) return;
    try {
      this.player = await this.sdk.getPlayer({ scopes: false });
    } catch (error) {
      console.warn('Не удалось обновить игрока после покупки:', error);
    }
  }

  /** Отложенная отправка: если недавно уже отправляли, последние данные уйдут, когда пройдёт интервал. */
  private scheduleCloud(): void {
    if (this.cloudTimer !== null) return;
    const wait = Math.max(0, this.lastCloudSave + CLOUD_INTERVAL_MS - Date.now());
    this.cloudTimer = setTimeout(() => {
      this.cloudTimer = null;
      this.sendToCloud(false).catch((error) => console.warn('Не удалось сохранить в облако:', error));
    }, wait);
  }

  private async sendToCloud(flush: boolean): Promise<void> {
    const wait = this.lastCloudSave + CLOUD_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    if (this.cloudPending === undefined || !this.player) return;
    if (this.cloudTimer !== null) {
      clearTimeout(this.cloudTimer);
      this.cloudTimer = null;
    }
    const data = this.cloudPending;
    this.cloudPending = undefined;
    this.lastCloudSave = Date.now();
    await this.player.setData({ [SAVE_KEY]: data }, flush);
  }
}

/** Покупки за Яны: каталог, оплата, необработанные покупки, consume. */
class YandexShop implements Payments {
  private readonly api: YandexPayments;
  private readonly afterPurchase: () => Promise<void>;

  constructor(api: YandexPayments, afterPurchase: () => Promise<void>) {
    this.api = api;
    this.afterPurchase = afterPurchase;
  }

  async getCatalog(): Promise<ShopProduct[]> {
    const products = await this.api.getCatalog();
    return products.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      priceValue: p.priceValue ?? p.price ?? '',
      currencyCode: p.priceCurrencyCode ?? '',
      currencyImage: currencyImage(p),
    }));
  }

  async purchase(productId: string): Promise<ShopPurchase | null> {
    let purchase: YandexPurchase;
    try {
      purchase = await this.api.purchase({ id: productId });
    } catch (error) {
      console.info('Покупка не состоялась:', error);
      return null;
    }
    await this.afterPurchase();
    return toPurchase(purchase);
  }

  async getPurchases(): Promise<ShopPurchase[]> {
    return (await this.api.getPurchases()).map(toPurchase);
  }

  async consume(token: string): Promise<void> {
    await this.api.consumePurchase(token);
  }
}

function toPurchase(purchase: YandexPurchase): ShopPurchase {
  return { productId: purchase.productID, token: purchase.purchaseToken };
}

function currencyImage(product: YandexProduct): string | null {
  try {
    return product.getPriceCurrencyImage?.('svg') || null;
  } catch {
    return null;
  }
}

/** Таблица рекордов: новый API, а если его нет — старый. */
class YandexRecords implements Leaderboard {
  private readonly sdk: YandexSdk;
  private readonly name: string;
  private readonly playerId: () => string | null;
  private legacy: Promise<YandexLegacyLeaderboards> | null = null;

  constructor(sdk: YandexSdk, name: string, playerId: () => string | null) {
    this.sdk = sdk;
    this.name = name;
    this.playerId = playerId;
  }

  async setScore(score: number): Promise<void> {
    const value = Math.max(0, Math.floor(score));
    if (this.sdk.leaderboards) await this.sdk.leaderboards.setScore(this.name, value);
    else await (await this.legacyApi()).setLeaderboardScore(this.name, value);
  }

  async getTable(): Promise<LeaderboardTable> {
    const options: EntriesOptions = { quantityTop: TOP, includeUser: true, quantityAround: AROUND };
    const result = this.sdk.leaderboards
      ? await this.sdk.leaderboards.getEntries(this.name, options)
      : await (await this.legacyApi()).getLeaderboardEntries(this.name, options);
    const entries = toEntries(result.entries, this.playerId());
    return { entries, player: entries.find((e) => e.isPlayer) ?? null, sample: false };
  }

  private legacyApi(): Promise<YandexLegacyLeaderboards> {
    if (!this.sdk.getLeaderboards) return Promise.reject(new Error('Таблицы рекордов недоступны'));
    this.legacy ??= this.sdk.getLeaderboards().catch((error: unknown) => {
      this.legacy = null; // попробуем снова в следующий раз
      throw error;
    });
    return this.legacy;
  }
}

/** Строки таблицы: места с единицы (в разных версиях SDK счёт идёт с нуля или с единицы), игрок отмечен. */
export function toEntries(entries: readonly YandexEntry[], playerId: string | null): LeaderboardEntry[] {
  const base = entries.some((e) => e.rank === 0) ? 1 : 0;
  return [...entries]
    .sort((a, b) => a.rank - b.rank)
    .map((e) => ({
      rank: e.rank + base,
      name: e.player.publicName?.trim() || 'Игрок скрыл имя',
      score: e.score,
      avatar: avatarOf(e),
      isPlayer: playerId !== null && e.player.uniqueID === playerId,
    }));
}

function avatarOf(entry: YandexEntry): string | null {
  try {
    return entry.player.getAvatarSrc?.('small') || null;
  } catch {
    return null;
  }
}
