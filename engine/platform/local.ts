import type { Platform } from './platform';

export interface LocalPlatformOptions {
  /** Сколько мс вместо рекламы висит табличка «Здесь будет реклама» (демо-сборка); 0 — реклама «проходит» мгновенно. */
  readonly adPreviewMs?: number;
}

/** Заглушка площадки для разработки и демо: сохранения в localStorage, вместо рекламы — пауза с табличкой или ничего. */
export class LocalPlatform implements Platform {
  readonly kind = 'local';
  readonly language = (navigator.language || 'ru').slice(0, 2);
  readonly minSaveInterval = 1000;
  private readonly storageKey: string;
  private readonly adPreviewMs: number;

  constructor(storageKey: string, options: LocalPlatformOptions = {}) {
    this.storageKey = storageKey;
    this.adPreviewMs = options.adPreviewMs ?? 0;
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
    await this.preview('📺 Здесь будет полноэкранная реклама');
  }

  async showRewardedAd(): Promise<boolean> {
    console.info('[реклама] за вознаграждение (заглушка) — награда выдана');
    await this.preview('📺 Здесь будет реклама за награду\nВ демо вместо ролика — эта табличка');
    return true;
  }

  onPause(): void {}
  onResume(): void {}

  /** Табличка на месте рекламы: видно, где игрок увидит ролик. */
  private async preview(text: string): Promise<void> {
    if (this.adPreviewMs <= 0) return;
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
    await new Promise((resolve) => window.setTimeout(resolve, this.adPreviewMs));
    overlay.remove();
  }
}
