import type { Platform } from './platform';

/** Заглушка площадки для разработки: сохранения в localStorage, реклама «показывается» мгновенно. */
export class LocalPlatform implements Platform {
  readonly kind = 'local';
  readonly language = (navigator.language || 'ru').slice(0, 2);
  readonly minSaveInterval = 1000;
  private readonly storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;
  }

  ready(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}

  async loadData(): Promise<unknown> {
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
      // приватный режим или переполненное хранилище — прогресс останется только в памяти
    }
  }

  async showFullscreenAd(): Promise<void> {
    console.info('[реклама] полноэкранная (заглушка)');
  }

  async showRewardedAd(): Promise<boolean> {
    console.info('[реклама] за вознаграждение (заглушка) — награда выдана');
    return true;
  }

  onPause(): void {}
  onResume(): void {}
}
