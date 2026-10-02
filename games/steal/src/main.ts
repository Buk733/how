import './style.css';
import { initPlatform, isDemoBuild, type Platform } from '@engine/platform/platform';
import { LANGUAGE_KEY, LEADERBOARD, SAVE_KEY } from './config';
import { PRODUCTS } from './data/shop';
import { Game } from './game';
import { DICTIONARIES, pickLanguage, setLanguage, t, type Language } from './i18n';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('В index.html нет элемента #app');

const loading = document.querySelector<HTMLElement>('#loading');

/**
 * Язык игры. На площадке — тот, что сообщил SDK (требование Яндекса 2.14), для незнакомых — русский
 * или английский по правилу 2.10. В демо и при разработке — выбранный игроком, ?lang=… или язык браузера.
 */
function chooseLanguage(platform: Platform): Language {
  if (!isDemoBuild()) return pickLanguage(platform.language);
  let saved: string | null = null;
  try {
    saved = window.localStorage.getItem(LANGUAGE_KEY);
  } catch {
    // хранилище недоступно (приватный режим) — берём язык браузера
  }
  return pickLanguage(new URLSearchParams(window.location.search).get('lang') ?? saved ?? platform.language);
}

async function main(root: HTMLElement): Promise<void> {
  // пока площадка отвечает, «Загрузка…» — на языке браузера, а не только по-русски
  const early = DICTIONARIES[pickLanguage(navigator.language || 'ru')];
  document.title = early.title;
  if (loading) loading.textContent = early.loading;
  const platform = await initPlatform({
    storageKey: SAVE_KEY,
    leaderboard: LEADERBOARD.name,
    // в демо и при разработке: на площадке названия и цены товаров задаёт Консоль
    demoCatalog: PRODUCTS.map((p) => ({ id: p.id, title: p.name, description: p.description, price: p.demoPrice })),
    demoTexts: () => t.demo,
  });
  const language = chooseLanguage(platform);
  setLanguage(language);
  document.documentElement.lang = language;
  document.title = t.title;
  if (loading) loading.textContent = t.loading;
  const game = await Game.create(root, platform);
  loading?.remove();
  // сначала «игра загрузилась» (LoadingAPI.ready), потом «игрок играет» (GameplayAPI.start)
  platform.ready();
  game.start();
  if (import.meta.env.DEV) Object.assign(window, { game: game.debug });
}

main(container).catch((error: unknown) => {
  console.error(error);
  if (loading) loading.textContent = t.loadFailed;
});
