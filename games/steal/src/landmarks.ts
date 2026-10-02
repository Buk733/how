import * as THREE from 'three';
import { renderSong, songDuration } from '@engine/chiptune';
import { formatNumber } from '@engine/format';
import { distanceXZ, type PointXZ } from '@engine/math';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';
import { AUDIO, CARPET } from './config';
import type { Action, GameContext } from './context';
import { SECRETS, type SecretDef } from './data/secrets';
import { totalIncome } from './economy';
import { SpeechBubble } from './entities/bubble';
import { t } from './i18n';
import { CAR_HEADING, GARDEN_PATH_X, PIER_PATH_X, SPOTS, TRAIL } from './layout';
import { BEAR_TUNE } from './music';
import { findSecret, SECRET_COUNT } from './secrets';
import { Car, CAR_PAINT, type VehicleTextures } from './vehicles';

/** Id наигрыша медведя: пока он звучит, фоновая мелодия притихает. */
export const BEAR_TUNE_ID = 'bear-tune';
const TUNE_SAMPLE_RATE = 22050;

/** С какого расстояния можно потрогать пасхалку (машину — издалека: она длинная). */
const REACH = 2.3;
const CAR_REACH = 3;

export interface LandmarkSheets {
  readonly hut: SpriteSheet;
  readonly bear: SpriteSheet;
  readonly campfire: SpriteSheet;
  readonly well: SpriteSheet;
  readonly outhouse: SpriteSheet;
  readonly fairyStone: SpriteSheet;
  readonly fisherman: SpriteSheet;
  readonly signpost: SpriteSheet;
}

/** Одна пасхалка: реплика над ней, что происходит по кнопке и как она живёт сама. */
interface Landmark {
  readonly secret: SecretDef;
  readonly spot: PointXZ;
  readonly reach: number;
  readonly bubble: SpeechBubble;
  /** Высота реплики над землёй. */
  readonly bubbleHeight: number;
  /** Сколько ещё секунд идёт действие (кнопка неактивна). */
  busy: number;
  time: number;
  run(): void;
  animate(dt: number): void;
}

const secretById = (id: string): SecretDef => {
  const secret = SECRETS.find((s) => s.id === id);
  if (!secret) throw new Error(`Нет пасхалки ${id}`);
  return secret;
};

/**
 * Пасхалки в лесу, в огороде и у пруда: подходишь — на кнопке действия появляется,
 * что можно сделать. Первая находка каждой — объявление и награда.
 */
export class Landmarks {
  private readonly ctx: GameContext;
  private readonly landmarks: Landmark[] = [];
  private tuneReady = false;

  constructor(ctx: GameContext, sheets: LandmarkSheets, vehicles: VehicleTextures) {
    this.ctx = ctx;
    const register = (id: keyof typeof SPOTS & string, bubbleHeight: number, reach = REACH) => {
      const landmark: Landmark = {
        secret: secretById(id),
        spot: SPOTS[id],
        reach,
        bubble: new SpeechBubble(ctx.labels.create('say-bubble landmark-say')),
        bubbleHeight,
        busy: 0,
        time: Math.random() * 5,
        run: () => {},
        animate: () => {},
      };
      this.landmarks.push(landmark);
      return landmark;
    };
    /** Пасхалка-спрайт. */
    const make = (id: keyof typeof SPOTS & string, sheet: SpriteSheet, bubbleHeight: number) => {
      const sprite = new BillboardSprite(sheet);
      sprite.object.position.set(SPOTS[id].x, 0, SPOTS[id].z);
      ctx.scene.add(sprite.object);
      return { ...register(id, bubbleHeight), sprite };
    };

    // --- камень на распутье: надпись по-сказочному, и она не врёт
    const stone = make('stone', sheets.fairyStone, 1.5);
    stone.run = () => {
      stone.bubble.say(t.landmarks.stone, 6);
      stone.busy = 1.5;
    };

    // --- избушка на курьих ножках: стоит задом, по просьбе топчется и поворачивается передом
    const hut = make('hut', sheets.hut, 3.6);
    let hutFront = 0;
    let hutStomp = 0;
    hut.run = () => {
      hutStomp = 1.3;
      hutFront = 10;
      hut.busy = 11.5;
      this.ctx.audio.blip('creak');
      hut.bubble.say(t.landmarks.hutCreak, 1.2);
    };
    hut.animate = (dt) => {
      hutStomp = Math.max(0, hutStomp - dt);
      if (hutStomp > 0) {
        // топчется: ножки по очереди, со звуком шагов
        const beat = Math.floor(hutStomp * 6);
        hut.sprite.setFrame(beat % 2 ? 1 : 0);
        if (beat !== Math.floor((hutStomp + dt) * 6)) this.ctx.audio.blip('stomp');
        if (hutStomp <= dt) hut.bubble.say(t.landmarks.hutWelcome, 2.5);
        return;
      }
      const front = hutFront > 0;
      hutFront = Math.max(0, hutFront - dt);
      // и задом, и передом иногда переминается с ноги на ногу
      const shuffle = Math.sin(hut.time * 1.7) > 0.93;
      hut.sprite.setFrame((front ? 2 : 0) + (shuffle ? 1 : 0));
    };

    // --- медведь в ушанке с балалайкой у костра
    const bear = make('bear', sheets.bear, 2.2);
    const campfire = new BillboardSprite(sheets.campfire);
    campfire.object.position.set(SPOTS.campfire.x, 0, SPOTS.campfire.z);
    ctx.scene.add(campfire.object);
    let fireTime = 0;
    bear.run = () => {
      const duration = this.playTune();
      bear.busy = duration;
      bear.bubble.say(t.landmarks.bear, Math.min(3, duration));
    };
    bear.animate = (dt) => {
      fireTime += dt;
      campfire.setFrame(Math.floor(fireTime * 8) % 3);
      bear.sprite.setFrame(bear.busy > 0 ? 1 + (Math.floor(bear.time * 8) % 2) : Math.sin(bear.time * 0.9) > 0.96 ? 1 : 0);
    };

    // --- колодец желаний
    const well = make('well', sheets.well, 2);
    well.run = () => {
      this.ctx.audio.blip('plop');
      well.bubble.say(t.landmarks.well, 2);
      well.busy = 1.5;
    };

    // --- домик в огороде: «Занято!»
    const toilet = make('toilet', sheets.outhouse, 2.3);
    let rattle = 0;
    toilet.run = () => {
      rattle = 0.9;
      toilet.busy = 2;
      this.ctx.audio.blip('creak');
      toilet.bubble.say(t.landmarks.toilet, 1.8);
    };
    toilet.animate = (dt) => {
      rattle = Math.max(0, rattle - dt);
      toilet.sprite.setFrame(rattle > 0 ? Math.floor(rattle * 14) % 2 : 0);
    };

    // --- рыбак на мостках: «Тсс!», потом клюёт и тянет рыбку
    const fisher = make('fisher', sheets.fisherman, 2);
    let catchTimer = -1;
    fisher.run = () => {
      fisher.bubble.say(t.landmarks.fisherHush, 1.6);
      catchTimer = 1.8;
      fisher.busy = 4.5;
    };
    fisher.animate = (dt) => {
      if (catchTimer >= 0) {
        const before = catchTimer;
        catchTimer -= dt;
        if (before > 0.9 && catchTimer <= 0.9) this.ctx.audio.blip('splash');
        if (before > 0 && catchTimer <= 0) {
          fisher.bubble.say(t.landmarks.fisherBite, 2.2);
          this.ctx.audio.blip('plop');
        }
        fisher.sprite.setFrame(catchTimer > 0.9 ? 0 : catchTimer > 0 ? 1 : 2);
        if (catchTimer < -2.5) catchTimer = -1;
        return;
      }
      // сам по себе иногда клюёт: поплавок дёргается
      fisher.sprite.setFrame(Math.sin(fisher.time * 0.8) > 0.97 ? 1 : 0);
    };

    // --- старая «копейка» в кустах: посигналить и мигнуть фарами, кузов качнётся на рессорах
    const car = register('car', 2.3, CAR_REACH);
    const model = new Car(vehicles, CAR_PAINT.oldBlue);
    model.root.position.set(SPOTS.car.x, 0, SPOTS.car.z);
    model.root.rotation.y = CAR_HEADING;
    ctx.scene.add(model.root);
    let blink = 0;
    car.run = () => {
      blink = 1.2;
      car.busy = 1.4;
      this.ctx.audio.blip('horn');
      car.bubble.say(t.landmarks.car, 1.2);
    };
    car.animate = (dt) => {
      blink = Math.max(0, blink - dt);
      model.setLights(blink > 0 && Math.floor(blink * 6) % 2 === 0);
      model.setLift(blink > 0 ? Math.abs(Math.sin(blink * 14)) * 0.05 * blink : 0);
    };

    // указатели с надписями: куда идти за пасхалками
    const trailX = (TRAIL.minX + TRAIL.maxX) / 2;
    const signZ = CARPET.z - CARPET.width / 2 - 0.6;
    this.signpost(sheets.signpost, trailX + 1.6, signZ, t.landmarks.signForest);
    this.signpost(sheets.signpost, GARDEN_PATH_X + 1.5, signZ, t.landmarks.signGarden);
    this.signpost(sheets.signpost, PIER_PATH_X - 1.5, signZ, t.landmarks.signPond);
    // надписи на воротах порталов
    for (const sign of ctx.world.portalSigns) {
      const label = this.ctx.labels.create('area-sign portal-sign');
      label.element.textContent = t.landmarks.portal;
      label.anchor.copy(sign);
    }
  }

  /** Что можно сделать с пасхалкой рядом с игроком. */
  findAction(): Action | null {
    const player = this.ctx.player.position;
    let best: Landmark | null = null;
    let bestDistance = Infinity;
    for (const landmark of this.landmarks) {
      const distance = distanceXZ(player, landmark.spot);
      if (distance < landmark.reach && distance < bestDistance) {
        best = landmark;
        bestDistance = distance;
      }
    }
    if (!best) return null;
    const target = best;
    const found = this.ctx.save.secrets.includes(target.secret.id);
    return {
      view: { title: target.secret.action, detail: found ? `${target.secret.name} ✓` : t.landmarks.unknown, enabled: target.busy <= 0 },
      run: () => this.use(target),
    };
  }

  update(dt: number): void {
    for (const landmark of this.landmarks) {
      landmark.time += dt;
      landmark.busy = Math.max(0, landmark.busy - dt);
      landmark.animate(dt);
      landmark.bubble.update(dt, new THREE.Vector3(landmark.spot.x, landmark.bubbleHeight, landmark.spot.z));
    }
  }

  private use(landmark: Landmark): void {
    if (landmark.busy > 0) return;
    landmark.run();
    const { save } = this.ctx;
    const reward = findSecret(save, landmark.secret.id, totalIncome(save));
    if (reward === null) return;
    const at = new THREE.Vector3(landmark.spot.x, 0, landmark.spot.z);
    this.ctx.audio.blip('secret');
    this.ctx.fx.sparkles(at, true);
    this.ctx.fx.coins(at.clone().setY(1), reward);
    this.ctx.hud.showBanner(
      t.landmarks.found(save.secrets.length, SECRET_COUNT, landmark.secret.name, formatNumber(reward)),
      '#73eff7',
      4000,
    );
    this.ctx.markDirty(true);
  }

  /** Наигрыш медведя: синтезируется при первой просьбе. Возвращает длину в секундах. */
  private playTune(): number {
    const { audio } = this.ctx;
    if (!this.tuneReady) {
      audio.addSamples(BEAR_TUNE_ID, renderSong(BEAR_TUNE, TUNE_SAMPLE_RATE), TUNE_SAMPLE_RATE, { normalizeTo: AUDIO.normalizeTo });
      this.tuneReady = true;
    }
    audio.play(BEAR_TUNE_ID, { volume: AUDIO.rareTheme, fadeOut: 0.6 });
    return songDuration(BEAR_TUNE);
  }

  /** Столбик со стрелкой и надписью. */
  private signpost(sheet: SpriteSheet, x: number, z: number, text: string): void {
    const sprite = new BillboardSprite(sheet);
    sprite.object.position.set(x, 0, z);
    this.ctx.scene.add(sprite.object);
    const label = this.ctx.labels.create('area-sign');
    label.element.textContent = text;
    label.anchor.set(x, 1.5, z);
  }
}
