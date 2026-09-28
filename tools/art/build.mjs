// Генерирует все спрайты и текстуры игры: `npm run art`.
// Картинки пишутся в games/steal/src/assets, превью всех листов — в tools/art/preview.png.
import { fileURLToPath } from 'node:url';
import { contactSheet } from './lib.mjs';
import * as characters from './characters.mjs';
import * as textures from './textures.mjs';

const root = fileURLToPath(new URL('../../games/steal/src/assets/', import.meta.url));

const outputs = {
  // персонажи
  'sprites/kotost.png': characters.kotost(),
  'sprites/panther.png': characters.panther(),
  'sprites/anime-cook.png': characters.animeCook(),
  'sprites/anime-knight.png': characters.animeKnight(),
  'sprites/diver.png': characters.diver(),
  'sprites/baba-chai.png': characters.babaChai(),
  'sprites/hamam.png': characters.hamam(),
  'sprites/hero.png': characters.hero(),
  // предметы и декор
  'sprites/coin.png': textures.coin(),
  'sprites/plate.png': textures.plate(),
  'sprites/steam.png': textures.steam(),
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
