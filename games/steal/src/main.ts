import './style.css';
import { initPlatform } from '@engine/platform/platform';
import { SAVE_KEY } from './config';
import { Game } from './game';

const container = document.querySelector<HTMLElement>('#app');
if (!container) throw new Error('В index.html нет элемента #app');

const loading = document.querySelector<HTMLElement>('#loading');

async function main(root: HTMLElement): Promise<void> {
  const platform = await initPlatform({ storageKey: SAVE_KEY });
  const game = await Game.create(root, platform);
  loading?.remove();
  game.start();
  platform.ready();
  if (import.meta.env.DEV) Object.assign(window, { game: game.debug });
}

main(container).catch((error: unknown) => {
  console.error(error);
  if (loading) loading.textContent = 'Не удалось запустить игру. Обновите страницу.';
});
