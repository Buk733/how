/**
 * Всё, что игра получает от площадки: сохранения, рекламу, язык, паузы, вход, покупки и рекорды.
 * На Яндекс Играх это Yandex Games SDK, при локальной разработке и в демо — заглушка на localStorage.
 */
export interface Platform {
  readonly kind: 'yandex' | 'local';
  /** Язык игрока (ru, en, tr, …), определённый площадкой. */
  readonly language: string;
  /** Как часто игре сохраняться после действий игрока, мс (облако площадки ограничивает частоту). */
  readonly minSaveInterval: number;
  /** Покупки за валюту площадки (у Яндекса — Яны) или null, если их нет. */
  readonly payments: Payments | null;
  /** Таблица рекордов или null, если её нет. */
  readonly leaderboard: Leaderboard | null;

  /** Игра загрузилась, в неё можно играть (для Яндекса — LoadingAPI.ready). */
  ready(): void;
  /** Игрок начал или закончил активную игру (для Яндекса — GameplayAPI). Звать только при смене состояния. */
  gameplayStart(): void;
  gameplayStop(): void;

  /** Обе копии сохранения — из облака и локальная; свежую выбирает игра. */
  loadData(): Promise<SaveCopies>;
  /**
   * Сохраняет: локальная копия — сразу, облачная — не чаще, чем позволяет площадка (последние данные
   * уходят чуть позже). flush — дождаться отправки в облако (например, перед тем как засчитать покупку).
   */
  saveData(data: unknown, options?: SaveOptions): Promise<void>;

  /** Полноэкранная реклама. Промис завершается, когда реклама закрыта или не показалась. */
  showFullscreenAd(): Promise<void>;
  /** Реклама за вознаграждение. true — игрок досмотрел, награду нужно выдать. */
  showRewardedAd(): Promise<boolean>;
  /** Стики-баннер площадки (включается в её консоли): прячется, если игрок купил отключение рекламы. */
  setBannerVisible(visible: boolean): void;

  /** Площадка просит поставить игру на паузу (например, показывает рекламу). */
  onPause(listener: () => void): void;
  onResume(listener: () => void): void;

  /** Игрок вошёл в аккаунт. Гости играют и сохраняются, но не попадают в рекорды. */
  isAuthorized(): boolean;
  /** Окно входа площадки. true — игрок вошёл. */
  openAuth(): Promise<boolean>;
}

/** Копии сохранения; null — такой копии нет. */
export interface SaveCopies {
  readonly cloud: unknown;
  readonly local: unknown;
}

export interface SaveOptions {
  /** Дождаться отправки в облако. */
  readonly flush?: boolean;
}

/** Товар магазина площадки. Название, описание и цену задаёт консоль площадки. */
export interface ShopProduct {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Цена числом, как её показывает площадка («99»). */
  readonly priceValue: string;
  /** Код валюты («YAN»). */
  readonly currencyCode: string;
  /** Картинка валюты из каталога площадки (по правилам Яндекса — показывать её рядом с ценой) или null. */
  readonly currencyImage: string | null;
}

/** Оплаченная покупка: её нужно выдать, а расходуемую потом отметить использованной (consume). */
export interface ShopPurchase {
  readonly productId: string;
  readonly token: string;
}

export interface Payments {
  getCatalog(): Promise<ShopProduct[]>;
  /** Оплата товара. null — игрок передумал или оплата не прошла. */
  purchase(productId: string): Promise<ShopPurchase | null>;
  /** Покупки, которые ещё не отмечены использованными: постоянные и необработанные расходуемые. */
  getPurchases(): Promise<ShopPurchase[]>;
  /** Расходуемая покупка выдана и сохранена — больше не возвращается в getPurchases. */
  consume(token: string): Promise<void>;
}

/** Строка таблицы рекордов. */
export interface LeaderboardEntry {
  /** Место с единицы. */
  readonly rank: number;
  readonly name: string;
  readonly score: number;
  readonly avatar: string | null;
  /** Это сам игрок. */
  readonly isPlayer: boolean;
}

export interface LeaderboardTable {
  readonly entries: readonly LeaderboardEntry[];
  /** Строка игрока, если он есть в таблице. */
  readonly player: LeaderboardEntry | null;
  /** Пример таблицы (демо): на площадке здесь будут настоящие игроки. */
  readonly sample: boolean;
}

export interface Leaderboard {
  /** Записать результат. Только для вошедших; площадка разрешает не чаще раза в секунду. */
  setScore(score: number): Promise<void>;
  /** Лучшие игроки и место самого игрока. */
  getTable(): Promise<LeaderboardTable>;
}

/** Товар для демо и разработки: на площадке его название и цену задаёт консоль. */
export interface DemoProduct {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly price: number;
}

export interface PlatformOptions {
  /** Ключ сохранения в localStorage (локальная копия). */
  readonly storageKey: string;
  /** Техническое имя таблицы рекордов в консоли площадки. */
  readonly leaderboard?: string;
  /** Товары для демо и разработки. */
  readonly demoCatalog?: readonly DemoProduct[];
}

const SDK_URL = '/sdk.js';
const SDK_TIMEOUT_MS = 5000;

/** Режим демо-сборки для артефакта (npm run artifact): без SDK, вместо рекламы и оплаты — табличка на полторы секунды. */
const DEMO_MODE = 'demo';
const DEMO_PREVIEW_MS = 1500;

/**
 * Подключает Yandex Games SDK, если игра открыта на Яндекс Играх, иначе — локальную заглушку.
 * В режиме разработки (npm run dev) и в демо-сборке SDK не загружается вовсе.
 */
export async function initPlatform(options: PlatformOptions): Promise<Platform> {
  const { LocalPlatform } = await import('./local');
  if (import.meta.env.DEV) return new LocalPlatform(options);
  if (import.meta.env.MODE === DEMO_MODE) return new LocalPlatform(options, { previewMs: DEMO_PREVIEW_MS });
  try {
    await loadScript(SDK_URL, SDK_TIMEOUT_MS);
    if (!window.YaGames) throw new Error('YaGames не найден');
    const { YandexPlatform } = await import('./yandex');
    return await YandexPlatform.create(window.YaGames, options);
  } catch (error) {
    console.info('Yandex Games SDK недоступен, работаем локально:', error);
    return new LocalPlatform(options);
  }
}

function loadScript(src: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => reject(new Error(`${src}: превышено время ожидания`)), timeout);
    script.src = src;
    script.onload = () => {
      window.clearTimeout(timer);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timer);
      reject(new Error(`${src}: не загрузился`));
    };
    document.head.append(script);
  });
}

/** Хранилище вида localStorage (в тестах — подделка). */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** localStorage, если он доступен (в приватном режиме и песочницах обращение может бросить исключение). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Читает JSON из хранилища; null — нет данных или они сломаны. */
export function readJson(storage: StorageLike | null, key: string): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Пишет JSON в хранилище; переполненное или запрещённое хранилище молча пропускается. */
export function writeJson(storage: StorageLike | null, key: string, data: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(data));
  } catch {
    // приватный режим или переполненное хранилище — прогресс останется в облаке или в памяти
  }
}
