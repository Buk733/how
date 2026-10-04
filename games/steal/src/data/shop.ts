// Товары за Яны. Правило площадки: за реальные деньги — только фиксированное содержимое, без случайностей
// (кейсы, колесо и парилка — только за монеты). Товары с такими же id заводятся в Консоли разработчика:
// там их название, описание, картинка и цена; игра показывает свои названия, а цену и значок валюты — из каталога.

import { t } from '../i18n';

export type ProductId = 'income_x2' | 'no_ads' | 'coin_chest';

export interface ProductDef {
  /** Латиница: так товар называется в Консоли и хранится в сохранении. Не менять после релиза. */
  readonly id: ProductId;
  readonly icon: string;
  /** Название и описание на языке игры (i18n: shop.products). */
  readonly name: string;
  readonly description: string;
  /**
   * permanent — покупается один раз и восстанавливается на любом устройстве (покупку не «используем»);
   * consumable — можно покупать снова (после выдачи покупку «используем» — consume).
   */
  readonly kind: 'permanent' | 'consumable';
  /** Цена в демо и при разработке, Ян. На площадке цену задаёт Консоль. */
  readonly demoPrice: number;
}

/** Доход ×2 навсегда: множитель входит в доход, в том числе вне игры, и переживает перерождения. */
export const INCOME_X2: ProductId = 'income_x2';
/** Без рекламы: нет полноэкранной рекламы и стики-баннера; ролики за награду остаются по желанию. */
export const NO_ADS: ProductId = 'no_ads';
/** Сундук монет: столько монет, сколько стоит полка игрока (SHOP.chestShare). */
export const COIN_CHEST: ProductId = 'coin_chest';

export const PRODUCTS: readonly ProductDef[] = (
  [
    { id: INCOME_X2, icon: '💎', kind: 'permanent', demoPrice: 199 },
    { id: NO_ADS, icon: '🚫', kind: 'permanent', demoPrice: 149 },
    { id: COIN_CHEST, icon: '💰', kind: 'consumable', demoPrice: 49 },
  ] satisfies Omit<ProductDef, 'name' | 'description'>[]
).map((product) => ({
  ...product,
  get name() {
    return t.shop.products[product.id].name;
  },
  get description() {
    return t.shop.products[product.id].description;
  },
}));

const byId = new Map<string, ProductDef>(PRODUCTS.map((p) => [p.id, p]));

export function productById(id: string): ProductDef | undefined {
  return byId.get(id);
}
