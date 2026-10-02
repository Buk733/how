import './style.css';
import { initPlatform } from '@engine/platform/platform';
import { LEADERBOARD, SAVE_KEY } from './config';
import { PRODUCTS } from './data/shop';
import { Game } from './game';

/** Языки интерфейса. Пока только русский (его площадка показывает для ru, be, kk, uk, uz); английский — в v1.0. */
const LANGUAGES: readonly string[] = ['ru'];

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('В index.html нет элемента #app');

const loading = document.querySelector<HTMLElement>('#loading');

async function main(root: HTMLElement): Promise<void> {
  const platform = await initPlatform({
    storageKey: SAVE_KEY,
    leaderboard: LEADERBOARD.name,
    // в демо и при разработке: на площадке названия и цены товаров задаёт Консоль
    demoCatalog: PRODUCTS.map((p) => ({ id: p.id, title: p.name, description: p.description, price: p.demoPrice })),
  });
  // язык — тот, что сообщила площадка (требование Яндекса), если он у нас есть
  document.documentElement.lang = LANGUAGES.includes(platform.language) ? platform.language : LANGUAGES[0];
  const game = await Game.create(root, platform);
  loading?.remove();
  // сначала «игра загрузилась» (LoadingAPI.ready), потом «игрок играет» (GameplayAPI.start)
  platform.ready();
  game.start();
  if (import.meta.env.DEV) Object.assign(window, { game: game.debug });
}

main(container).catch((error: unknown) => {
  console.error(error);
  if (loading) loading.textContent = 'Не удалось запустить игру. Обновите страницу.';
});
