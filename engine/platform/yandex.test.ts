import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StorageLike } from './platform';
import { toEntries, YandexPlatform, type YandexSdk } from './yandex';

/** Хранилище в памяти вместо localStorage. */
function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

/** Поддельный SDK: записывает вызовы, облако — объект в памяти. */
function fakeSdk(changes: Partial<YandexSdk> = {}, mode = 'lite') {
  const calls: string[] = [];
  const cloud: Record<string, unknown> = {};
  const player = {
    getData: async () => ({ ...cloud }),
    setData: async (data: Record<string, unknown>, flush?: boolean) => {
      calls.push(`setData ${JSON.stringify(data.save)} flush=${flush === true}`);
      Object.assign(cloud, data);
    },
    getUniqueID: () => 'me',
    getMode: () => mode,
  };
  const sdk: YandexSdk = {
    environment: { i18n: { lang: 'ru' } },
    features: {
      LoadingAPI: { ready: () => calls.push('ready') },
      GameplayAPI: { start: () => calls.push('start'), stop: () => calls.push('stop') },
    },
    adv: {
      showFullscreenAdv: ({ callbacks }) => callbacks.onClose?.(true),
      showRewardedVideo: ({ callbacks }) => {
        callbacks.onRewarded?.();
        callbacks.onClose?.();
      },
    },
    getPlayer: async () => player,
    on: () => {},
    ...changes,
  };
  return { sdk, calls, cloud, player };
}

const create = (sdk: YandexSdk, storage: StorageLike = memoryStorage()) =>
  YandexPlatform.create({ init: async () => sdk }, { storageKey: 'test.save', leaderboard: 'income' }, { storage });

afterEach(() => {
  vi.useRealTimers();
});

describe('Яндекс: сохранения', () => {
  it('отдаёт обе копии — облачную и локальную', async () => {
    const { sdk, cloud } = fakeSdk();
    cloud.save = { savedAt: 1 };
    const storage = memoryStorage();
    storage.setItem('test.save', JSON.stringify({ savedAt: 2 }));
    const platform = await create(sdk, storage);
    expect(await platform.loadData()).toEqual({ cloud: { savedAt: 1 }, local: { savedAt: 2 } });
  });

  it('локальная копия пишется сразу, в облако — не чаще раза в 4 секунды, последние данные уходят позже', async () => {
    vi.useFakeTimers();
    const { sdk, calls } = fakeSdk();
    const storage = memoryStorage();
    const platform = await create(sdk, storage);
    await platform.saveData({ n: 1 });
    await vi.advanceTimersByTimeAsync(0);
    await platform.saveData({ n: 2 });
    await platform.saveData({ n: 3 });
    expect(storage.data.get('test.save')).toBe('{"n":3}');
    await vi.advanceTimersByTimeAsync(3900);
    expect(calls.filter((c) => c.startsWith('setData'))).toEqual(['setData {"n":1} flush=false']);
    await vi.advanceTimersByTimeAsync(200);
    expect(calls.filter((c) => c.startsWith('setData'))).toEqual(['setData {"n":1} flush=false', 'setData {"n":3} flush=false']);
  });

  it('flush дожидается отправки в облако (например, перед тем как засчитать покупку)', async () => {
    vi.useFakeTimers();
    const { sdk, calls } = fakeSdk();
    const platform = await create(sdk);
    await platform.saveData({ n: 1 });
    await vi.advanceTimersByTimeAsync(0);
    let done = false;
    const flushing = platform.saveData({ n: 2 }, { flush: true }).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1000);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    await flushing;
    expect(calls.at(-1)).toBe('setData {"n":2} flush=true');
  });

  it('без игрока (SDK его не отдал) сохраняет только локально', async () => {
    const { sdk } = fakeSdk({ getPlayer: () => Promise.reject(new Error('нет')) });
    const storage = memoryStorage();
    const platform = await create(sdk, storage);
    await platform.saveData({ n: 1 });
    expect(await platform.loadData()).toEqual({ cloud: null, local: { n: 1 } });
  });
});

describe('Яндекс: вход и реклама', () => {
  it('гость — пока getMode() «lite»; новый isAuthorized() важнее', async () => {
    expect((await create(fakeSdk().sdk)).isAuthorized()).toBe(false);
    expect((await create(fakeSdk({}, '').sdk)).isAuthorized()).toBe(true);
    const withNewMethod = fakeSdk();
    withNewMethod.sdk.getPlayer = async () => ({ ...withNewMethod.player, isAuthorized: () => true });
    expect((await create(withNewMethod.sdk)).isAuthorized()).toBe(true);
  });

  it('вход: после окна входа игрок обновляется; закрыл окно — остаётся гостем', async () => {
    const { sdk, player } = fakeSdk();
    let loggedIn = false;
    sdk.auth = { openAuthDialog: async () => void (loggedIn = true) };
    sdk.getPlayer = async () => ({ ...player, getMode: () => (loggedIn ? '' : 'lite') });
    const platform = await create(sdk);
    expect(platform.isAuthorized()).toBe(false);
    expect(await platform.openAuth()).toBe(true);
    expect(platform.isAuthorized()).toBe(true);

    const refused = fakeSdk();
    refused.sdk.auth = { openAuthDialog: () => Promise.reject(new Error('закрыл')) };
    expect(await (await create(refused.sdk)).openAuth()).toBe(false);
  });

  it('награда за рекламу — только после onRewarded', async () => {
    const { sdk } = fakeSdk();
    sdk.adv.showRewardedVideo = ({ callbacks }) => callbacks.onClose?.();
    expect(await (await create(sdk)).showRewardedAd()).toBe(false);
    expect(await (await create(fakeSdk().sdk)).showRewardedAd()).toBe(true);
  });
});

describe('Яндекс: покупки', () => {
  const product = {
    id: 'no_ads',
    title: 'Без рекламы',
    description: 'Навсегда',
    price: '149 YAN',
    priceValue: '149',
    priceCurrencyCode: 'YAN',
    getPriceCurrencyImage: () => 'https://yastatic.net/yan.svg',
  };

  it('каталог — с ценой и картинкой валюты, покупка и необработанные — с токеном', async () => {
    const consumed: string[] = [];
    const { sdk } = fakeSdk({
      payments: {
        getCatalog: async () => [product],
        purchase: async ({ id }) => ({ productID: id, purchaseToken: 't1' }),
        getPurchases: async () => [{ productID: 'coin_chest', purchaseToken: 't0' }],
        consumePurchase: async (token) => void consumed.push(token),
      },
    });
    const payments = (await create(sdk)).payments;
    expect(await payments?.getCatalog()).toEqual([
      { id: 'no_ads', title: 'Без рекламы', description: 'Навсегда', priceValue: '149', currencyCode: 'YAN', currencyImage: 'https://yastatic.net/yan.svg' },
    ]);
    expect(await payments?.purchase('no_ads')).toEqual({ productId: 'no_ads', token: 't1' });
    expect(await payments?.getPurchases()).toEqual([{ productId: 'coin_chest', token: 't0' }]);
    await payments?.consume('t0');
    expect(consumed).toEqual(['t0']);
  });

  it('передумал платить — null; старый SDK отдаёт покупки через getPayments()', async () => {
    const api = {
      getCatalog: async () => [],
      purchase: () => Promise.reject(new Error('отмена')),
      getPurchases: async () => [],
      consumePurchase: async () => {},
    };
    const { sdk } = fakeSdk({ getPayments: async () => api });
    const payments = (await create(sdk)).payments;
    expect(payments).not.toBeNull();
    expect(await payments?.purchase('no_ads')).toBeNull();
  });

  it('гость вошёл в окне оплаты — после покупки игрок обновляется, сохранения идут в аккаунт', async () => {
    const { sdk, player } = fakeSdk();
    let loggedIn = false;
    sdk.getPlayer = async () => ({ ...player, getMode: () => (loggedIn ? '' : 'lite') });
    sdk.payments = {
      getCatalog: async () => [],
      purchase: async ({ id }) => {
        loggedIn = true;
        return { productID: id, purchaseToken: 't' };
      },
      getPurchases: async () => [],
      consumePurchase: async () => {},
    };
    const platform = await create(sdk);
    expect(platform.isAuthorized()).toBe(false);
    await platform.payments?.purchase('no_ads');
    expect(platform.isAuthorized()).toBe(true);
  });

  it('нет покупок в SDK — магазина нет', async () => {
    expect((await create(fakeSdk().sdk)).payments).toBeNull();
  });
});

describe('Яндекс: рекорды', () => {
  it('новый API: результат целым числом, таблица с местами и отметкой игрока', async () => {
    const scores: [string, number][] = [];
    const { sdk } = fakeSdk({
      leaderboards: {
        setScore: async (name, score) => void scores.push([name, score]),
        getEntries: async () => ({
          entries: [
            { rank: 2, score: 50, player: { publicName: 'Я', uniqueID: 'me' } },
            { rank: 1, score: 90, player: { publicName: '', uniqueID: 'x', getAvatarSrc: () => 'a.png' } },
          ],
        }),
      },
    });
    const board = (await create(sdk)).leaderboard;
    await board?.setScore(1234.9);
    expect(scores).toEqual([['income', 1234]]);
    const table = await board?.getTable();
    expect(table?.entries.map((e) => [e.rank, e.name, e.isPlayer, e.avatar])).toEqual([
      [1, '', false, 'a.png'],
      [2, 'Я', true, null],
    ]);
    expect(table?.player?.score).toBe(50);
  });

  it('старый API — если нового нет', async () => {
    const scores: number[] = [];
    const { sdk } = fakeSdk({
      getLeaderboards: async () => ({
        setLeaderboardScore: async (_name, score) => void scores.push(score),
        getLeaderboardEntries: async () => ({ entries: [] }),
      }),
    });
    await (await create(sdk)).leaderboard?.setScore(7);
    expect(scores).toEqual([7]);
  });

  it('места считаются с единицы, даже если SDK считает с нуля', () => {
    const rows = toEntries(
      [
        { rank: 0, score: 9, player: { uniqueID: 'a' } },
        { rank: 1, score: 5, player: { uniqueID: 'me' } },
      ],
      'me',
    );
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
    expect(rows[1].isPlayer).toBe(true);
  });
});
