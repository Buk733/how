import { describe, expect, it } from 'vitest';
import { LocalPlatform } from './local';

describe('локальная площадка', () => {
  it('в демо: покупки и рейтинг-пример есть, реклама за награду «досматривается»', async () => {
    const demo = new LocalPlatform({ storageKey: 'k', leaderboard: 'income', demoCatalog: [{ id: 'a', title: 'A', description: '', price: 1 }] }, { storage: null });
    expect(demo.payments).not.toBeNull();
    expect(demo.leaderboard).not.toBeNull();
    expect(await demo.showRewardedAd()).toBe(true);
  });

  it('сборка для площадки без SDK: ни покупок, ни рейтинга, ни наград без рекламы', async () => {
    const fallback = new LocalPlatform({ storageKey: 'k' }, { storage: null, rewardedAds: false });
    expect(fallback.payments).toBeNull();
    expect(fallback.leaderboard).toBeNull();
    expect(await fallback.showRewardedAd()).toBe(false);
  });
});
