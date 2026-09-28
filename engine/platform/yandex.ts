import type { Platform } from './platform';

// Минимальные типы Yandex Games SDK — только то, что использует игра.
// Документация: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about

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
}

interface YandexSdk {
  environment: { i18n: { lang: string } };
  features: {
    LoadingAPI?: { ready(): void };
    GameplayAPI?: { start(): void; stop(): void };
  };
  adv: {
    showFullscreenAdv(options: { callbacks: AdCallbacks }): void;
    showRewardedVideo(options: { callbacks: AdCallbacks }): void;
  };
  getPlayer(options?: { scopes?: boolean; signed?: boolean }): Promise<YandexPlayer>;
  on(event: 'game_api_pause' | 'game_api_resume', listener: () => void): void;
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YandexSdk> };
  }
}

const SAVE_KEY = 'save';

export class YandexPlatform implements Platform {
  readonly kind = 'yandex';
  readonly language: string;
  /** setData — не чаще 100 раз за 5 минут, берём с запасом. */
  readonly minSaveInterval = 5000;
  private readonly sdk: YandexSdk;
  private readonly player: YandexPlayer | null;
  private readonly storageKey: string;

  private constructor(sdk: YandexSdk, player: YandexPlayer | null, storageKey: string) {
    this.sdk = sdk;
    this.player = player;
    this.storageKey = storageKey;
    this.language = sdk.environment.i18n.lang;
  }

  static async create(yaGames: { init(): Promise<YandexSdk> }, storageKey: string): Promise<YandexPlatform> {
    const sdk = await yaGames.init();
    let player: YandexPlayer | null = null;
    try {
      // Сохранения работают и для гостей, без запроса доступа к профилю.
      player = await sdk.getPlayer({ scopes: false });
    } catch (error) {
      console.warn('Не удалось получить игрока, сохраняем в localStorage:', error);
    }
    return new YandexPlatform(sdk, player, storageKey);
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

  async loadData(): Promise<unknown> {
    if (this.player) {
      try {
        const data = await this.player.getData([SAVE_KEY]);
        if (data[SAVE_KEY] !== undefined) return data[SAVE_KEY];
      } catch (error) {
        console.warn('Не удалось загрузить облачное сохранение:', error);
      }
    }
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as unknown) : null;
    } catch {
      return null;
    }
  }

  async saveData(data: unknown): Promise<void> {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch {
      // локальная копия — только запасной вариант
    }
    if (this.player) await this.player.setData({ [SAVE_KEY]: data });
  }

  showFullscreenAd(): Promise<void> {
    return new Promise((resolve) => {
      this.sdk.adv.showFullscreenAdv({
        callbacks: {
          onClose: () => resolve(),
          onError: () => resolve(),
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
          onRewarded: () => {
            rewarded = true;
          },
          onClose: () => resolve(rewarded),
          onError: () => resolve(false),
        },
      });
    });
  }

  onPause(listener: () => void): void {
    this.sdk.on('game_api_pause', listener);
  }

  onResume(listener: () => void): void {
    this.sdk.on('game_api_resume', listener);
  }
}
