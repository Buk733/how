// Генерирует все спрайты и текстуры игры: `npm run art`.
// Картинки пишутся в games/steal/src/assets, превью всех листов — в tools/art/preview.png.
import { fileURLToPath } from 'node:url';
import { contactSheet, goldify } from './lib.mjs';
import * as characters from './characters.mjs';
import * as scenery from './scenery.mjs';
import * as textures from './textures.mjs';
import * as vehicles from './vehicles.mjs';

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
  'sprites/bucket.png': textures.bucket(),
  'sprites/smoke.png': scenery.smoke(),
  'sprites/dust.png': scenery.dust(),
  // лес
  'sprites/tree.png': scenery.trees(),
  'sprites/pine.png': scenery.pines(),
  'sprites/birch.png': scenery.birches(),
  'sprites/bush.png': scenery.bushes(),
  'sprites/stump.png': scenery.stumps(),
  'sprites/log.png': scenery.log(),
  'sprites/rock.png': scenery.rocks(),
  'sprites/mushroom.png': scenery.mushrooms(),
  'sprites/flower.png': scenery.flowers(),
  'sprites/grass-tuft.png': scenery.grassTufts(),
  'sprites/fern.png': scenery.ferns(),
  // пасхалки
  'sprites/hut.png': scenery.hut(),
  'sprites/bear.png': scenery.bear(),
  'sprites/campfire.png': scenery.campfire(),
  'sprites/well.png': scenery.well(),
  'sprites/outhouse.png': scenery.outhouse(),
  'sprites/fairy-stone.png': scenery.fairyStone(),
  'sprites/fisherman.png': scenery.fisherman(),
  // постройки и мелочи
  'sprites/windmill.png': scenery.windmill(),
  'sprites/scarecrow.png': scenery.scarecrow(),
  'sprites/kennel.png': scenery.kennel(),
  'sprites/bell.png': scenery.bell(),
  'sprites/lantern.png': scenery.lantern(),
  'sprites/woodpile.png': scenery.woodpile(),
  'sprites/fence.png': scenery.fence(),
  'sprites/bus-stop.png': scenery.busStop(),
  'sprites/crops.png': scenery.crops(),
  'sprites/signpost.png': scenery.signpost(),
  // животные: собаки соседей — рыжий Шарик и чёрный Бобик
  'sprites/duck.png': scenery.duck(),
  'sprites/bird.png': scenery.bird(),
  'sprites/butterfly.png': scenery.butterfly(),
  'sprites/dog-brown.png': scenery.dog(),
  'sprites/dog-black.png': scenery.dog({ fur: '#4a4456', light: '#6a6478', dark: '#2b2733', collar: '#41a6f6' }),
  // тайлы
  'textures/grass.png': textures.grass(),
  'textures/planks.png': textures.planks(),
  'textures/logs.png': textures.logs(),
  'textures/carpet.png': textures.carpet(),
  'textures/stone.png': textures.stone(),
  'textures/water.png': scenery.water(),
  // объёмные модели: старая «копейка» (ряд 0 — голубая, ряд 1 — вишнёвая), трактор, портал с воротами
  'textures/car-body-side.png': vehicles.carBodySide(),
  'textures/car-body-top.png': vehicles.carBodyTop(),
  'textures/car-body-end.png': vehicles.carBodyEnd(),
  'textures/car-cabin-side.png': vehicles.carCabinSide(),
  'textures/car-cabin-top.png': vehicles.carCabinTop(),
  'textures/car-cabin-end.png': vehicles.carCabinEnd(),
  'textures/tire.png': vehicles.tire(),
  'textures/hub-car.png': vehicles.hubCar(),
  'textures/tractor-hood-side.png': vehicles.tractorHoodSide(),
  'textures/tractor-hood-top.png': vehicles.tractorHoodTop(),
  'textures/tractor-grille.png': vehicles.tractorGrille(),
  'textures/tractor-cabin-side.png': vehicles.tractorCabinSide(),
  'textures/tractor-cabin-front.png': vehicles.tractorCabinFront(),
  'textures/tractor-roof.png': vehicles.tractorRoof(),
  'textures/tractor-tire.png': vehicles.tractorTire(),
  'textures/hub-tractor.png': vehicles.hubTractor(),
  'textures/portal-pad.png': vehicles.portalPad(),
  'textures/portal-swirl.png': vehicles.portalSwirl(),
  'textures/gate-post.png': vehicles.gatePost(),
  'textures/gate-beam.png': vehicles.gateBeam(),
  'textures/gate-sign.png': vehicles.gateSign(),
};

for (const [path, img] of Object.entries(outputs)) img.save(root + path);
contactSheet(Object.values(outputs), 5).save(fileURLToPath(new URL('./preview.png', import.meta.url)));
console.log(`Готово: ${Object.keys(outputs).length} картинок → games/steal/src/assets`);
