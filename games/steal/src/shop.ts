// Покупки за Яны без графики: что даёт товар и как выдать покупку ровно один раз.
import { SHOP } from './config';
import { COIN_CHEST, NO_ADS, productById, type ProductDef } from './data/shop';
import { steadyIncome } from './economy';
import type { SaveData } from './save';

/** Оплаченная покупка: какой товар и её токен на площадке. */
export interface PaidPurchase {
  readonly productId: string;
  readonly token: string;
}

export type GrantResult =
  /** Выдано сейчас (coins — сколько монет, если товар — монеты). */
  | { readonly kind: 'granted'; readonly product: ProductDef; readonly coins: number }
  /** Уже было выдано раньше: постоянный товар уже есть или токен уже обработан. */
  | { readonly kind: 'already'; readonly product: ProductDef }
  /** Товара нет в игре (например, убран из каталога) — ничего не выдаём. */
  | { readonly kind: 'unknown' };

/** Есть ли у игрока постоянный товар. */
export function owns(save: SaveData, id: string): boolean {
  return save.purchases.owned.includes(id);
}

/** Куплено «Без рекламы»: полноэкранной рекламы и стики-баннера нет. */
export function adsDisabled(save: SaveData): boolean {
  return owns(save, NO_ADS);
}

/** Сколько монет в сундуке: SHOP.chestMinutes минут дохода без ускорителя, но не меньше SHOP.chestMin. */
export function chestCoins(save: SaveData): number {
  return Math.max(SHOP.chestMin, Math.floor(steadyIncome(save) * SHOP.chestMinutes * 60));
}

/**
 * Выдаёт покупку ровно один раз. Постоянный товар попадает в owned (повторная выдача ничего не меняет),
 * расходуемый — выдаётся, а его токен запоминается: если сохранение прошло, а отметить покупку
 * использованной не удалось, при следующем запуске она придёт снова — и не будет выдана второй раз.
 */
export function grantPurchase(save: SaveData, purchase: PaidPurchase): GrantResult {
  const product = productById(purchase.productId);
  if (!product) return { kind: 'unknown' };
  if (product.kind === 'permanent') {
    if (owns(save, product.id)) return { kind: 'already', product };
    save.purchases.owned.push(product.id);
    return { kind: 'granted', product, coins: 0 };
  }
  if (save.purchases.granted.includes(purchase.token)) return { kind: 'already', product };
  save.purchases.granted = [...save.purchases.granted, purchase.token].slice(-SHOP.rememberTokens);
  let coins = 0;
  if (product.id === COIN_CHEST) {
    coins = chestCoins(save);
    save.coins += coins;
    save.stats.earned += coins;
  }
  return { kind: 'granted', product, coins };
}

/** Расходуемые покупки после выдачи и сохранения отмечаются на площадке использованными; постоянные — никогда. */
export function needsConsume(productId: string): boolean {
  return productById(productId)?.kind === 'consumable';
}
