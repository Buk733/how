// Генерирует все спрайты и текстуры игры: `npm run art`.
// Картинки пишутся в games/steal/src/assets, превью всех листов — в tools/art/preview.png.
import { fileURLToPath } from 'node:url';
import { contactSheet, goldify } from './lib.mjs';
import * as characters from './characters.mjs';
import * as textures from './textures.mjs';

const root = fileURLToPath(new URL('../../games/steal/src/assets/', import.meta.url));

/** Персонажи: id (имя файла) → рисунок. Для каждого сама рисуется «Голда» — <id>-gold.png. */
const CHARACTERS = {
  kotost: characters.kotost(),
  panther: characters.panther(),
  'anime-cook': characters.animeCook(),
  'anime-knight': characters.animeKnight(),
  diver: characters.diver(),
  'baba-chai': characters.babaChai(),
  hamam: characters.hamam(),
  'koch-bratan': characters.kochBratan(),
  'dark-drun': characters.darkDrun(),
  schoolboy: characters.schoolboy(),
  'fat-mellstroy': characters.fatMellstroy(),
  'indian-mellstroy': characters.indianMellstroy(),
};

const outputs = {
  // персонажи и их «Голда»
  ...Object.fromEntries(
    Object.entries(CHARACTERS).flatMap(([id, img]) => [
      [`sprites/${id}.png`, img],
      [`sprites/${id}-gold.png`, goldify(img)],
    ]),
  ),
  // герой и соседи-боты: тот же герой в других цветах
  'sprites/hero.png': characters.hero(),
  'sprites/neighbor-green.png': characters.hero({ r: '#38b764', R: '#257179', o: '#a7f070', b: '#f4f4f4', B: '#94b0c2' }),
  'sprites/neighbor-purple.png': characters.hero({ r: '#8e5bd6', R: '#5d275d', o: '#c7a1f0', b: '#73eff7', B: '#257179' }),
  'sprites/broom-swing.png': characters.broomSwing(),
  // предметы и декор
  'sprites/coin.png': textures.coin(),
  'sprites/plate.png': textures.plate(),
  'sprites/steam.png': textures.steam(),
  'sprites/sparkle.png': textures.sparkle(),
  'sprites/tree.png': textures.tree(),
  'sprites/pine.png': textures.pine(),
  'sprites/bush.png': textures.bush(),
  'sprites/bucket.png': textures.bucket(),
  // тайлы
  'textures/grass.png': textures.grass(),
  'textures/planks.png': textures.planks(),
  'textures/logs.png': textures.logs(),
  'textures/carpet.png': textures.carpet(),
  'textures/stone.png': textures.stone(),
};

for (const [path, img] of Object.entries(outputs)) img.save(root + path);
contactSheet(Object.values(outputs), 5).save(fileURLToPath(new URL('./preview.png', import.meta.url)));
console.log(`Готово: ${Object.keys(outputs).length} картинок → games/steal/src/assets`);
