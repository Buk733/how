/**
 * Всё, что игра получает от площадки: сохранения, рекламу, язык, паузы.
 * На Яндекс Играх это Yandex Games SDK, при локальной разработке — заглушка на localStorage.
 */
export interface Platform {
  readonly kind: 'yandex' | 'local';
  /** Язык игрока (ru, en, tr, …), определённый площадкой. */
  readonly language: string;
  /** Как часто можно сохранять, мс (у Яндекса есть лимит на частоту запросов). */
  readonly minSaveInterval: number;

  /** Игра загрузилась, в неё можно играть (для Яндекса — LoadingAPI.ready). */
  ready(): void;
  /** Игрок начал или закончил активную игру (для Яндекса — GameplayAPI). */
  gameplayStart(): void;
  gameplayStop(): void;

  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;

  /** Полноэкранная реклама. Промис завершается, когда реклама закрыта или не показалась. */
  showFullscreenAd(): Promise<void>;
  /** Реклама за вознаграждение. true — игрок досмотрел, награду нужно выдать. */
  showRewardedAd(): Promise<boolean>;

  /** Площадка просит поставить игру на паузу (например, показывает рекламу). */
  onPause(listener: () => void): void;
  onResume(listener: () => void): void;
}

export interface PlatformOptions {
  /** Ключ сохранения в localStorage для локального режима. */
  readonly storageKey: string;
}

const SDK_URL = '/sdk.js';
const SDK_TIMEOUT_MS = 5000;

/** Режим демо-сборки для артефакта (npm run artifact): без SDK, вместо рекламы — табличка на полторы секунды. */
const DEMO_MODE = 'demo';
const DEMO_AD_MS = 1500;

/**
 * Подключает Yandex Games SDK, если игра открыта на Яндекс Играх, иначе — локальную заглушку.
 * В режиме разработки (npm run dev) и в демо-сборке SDK не загружается вовсе.
 */
export async function initPlatform(options: PlatformOptions): Promise<Platform> {
  const { LocalPlatform } = await import('./local');
  if (import.meta.env.DEV) return new LocalPlatform(options.storageKey);
  if (import.meta.env.MODE === DEMO_MODE) return new LocalPlatform(options.storageKey, { adPreviewMs: DEMO_AD_MS });
  try {
    await loadScript(SDK_URL, SDK_TIMEOUT_MS);
    if (!window.YaGames) throw new Error('YaGames не найден');
    const { YandexPlatform } = await import('./yandex');
    return await YandexPlatform.create(window.YaGames, options.storageKey);
  } catch (error) {
    console.info('Yandex Games SDK недоступен, работаем локально:', error);
    return new LocalPlatform(options.storageKey);
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
