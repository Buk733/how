import * as THREE from 'three';
import { loadPixelTexture, loadSpriteSheets, loadTileTexture } from '@engine/assets';
import { AudioManager } from '@engine/audio';
import { FollowCamera } from '@engine/camera';
import { renderSongGradually } from '@engine/chiptune';
import { Input } from '@engine/input';
import { LabelLayer, type Label } from '@engine/labels';
import type { Platform } from '@engine/platform/platform';
import { Rng } from '@engine/rng';
import type { SpriteSheet, SpriteSheetDef } from '@engine/sprite';
import { Broom } from './broom';
import { Carpet, RARE_THEME } from './carpet';
import { AUDIO, BROOM, CAMERA, CARPET, FOG, PLAYER, RENDER_SHORT_SIDE, SKY_COLOR } from './config';
import type { Action, GameContext, TutorialEvent } from './context';
import { CHARACTERS, type CharacterDef } from './data/characters';
import { spriteUrl, textureUrl } from './data/sprites';
import { baseIncome, totalIncome } from './economy';
import { Effects } from './effects';
import { Brainrot } from './entities/brainrot';
import { Player } from './entities/player';
import { Home } from './home';
import { BEAR_TUNE_ID, Landmarks } from './landmarks';
import { Menus } from './menus';
import { BANYA_POLKA } from './music';
import { Neighborhood } from './neighborhood';
import { PORTAL_TEXTURES } from './portals';
import { parseSave, TUTORIAL_DONE, type SaveData } from './save';
import { Spawner } from './spawner';
import { Hud, type MenuId } from './ui/hud';
import { broomStun, speedMultiplier } from './upgrades';
import { VEHICLE_TEXTURES } from './vehicles';
import { buildWorld, type World } from './world';
import rareThemeUrl from './sounds/rare-theme.mp3';

/** Самый длинный шаг симуляции: если вкладка «подвисла», мир не прыгнет вперёд. */
const MAX_DT = 0.1;
/** Как часто сохранять накопленные монеты, если игрок ничего не делает, мс. */
const PASSIVE_SAVE_INTERVAL = 10_000;
/** Персонажи 32×32 при 18 px на единицу — чуть выше героя. */
const CHARACTER_PPU = 18;
/** Id фоновой мелодии и частота, с которой она синтезируется. */
const BACKGROUND_MUSIC = 'background-music';
const MUSIC_SAMPLE_RATE = 32000;
/** Сколько миллисекунд кадра можно тратить на синтез мелодии. */
const MUSIC_JOB_BUDGET_MS = 4;
/** Клавиши окон. */
const MENU_KEYS: Readonly<Record<string, MenuId>> = { KeyU: 'upgrades', KeyK: 'cases', KeyL: 'wheel', KeyP: 'upgrader' };
/** Как часто из-под ног бегущего героя вылетает облачко пыли, секунды. */
const DUST_INTERVAL = 0.16;

/** Лист спрайта по имени файла: размер кадра и сколько пикселей в единице мира. */
const sheet = (name: string, frameWidth: number, frameHeight: number, pixelsPerUnit = 16): SpriteSheetDef => ({
  url: spriteUrl(name),
  frameWidth,
  frameHeight,
  pixelsPerUnit,
});

const SHEETS = {
  // герой, соседи и их хозяйство
  hero: sheet('hero', 16, 16, 12),
  neighborGreen: sheet('neighbor-green', 16, 16, 12),
  neighborPurple: sheet('neighbor-purple', 16, 16, 12),
  dogBrown: sheet('dog-brown', 20, 16),
  dogBlack: sheet('dog-black', 20, 16),
  broom: sheet('broom-swing', 24, 24, 20),
  bell: sheet('bell', 8, 12),
  kennel: sheet('kennel', 22, 20),
  // частицы и мелочи бани
  sparkle: sheet('sparkle', 8, 8, 16),
  plate: sheet('plate', 16, 16, 11),
  steam: sheet('steam', 8, 8, 10),
  smoke: sheet('smoke', 8, 8, 12),
  dust: sheet('dust', 8, 8, 18),
  bucket: sheet('bucket', 16, 16, 20),
  lantern: sheet('lantern', 10, 26),
  woodpile: sheet('woodpile', 24, 18),
  // лес и луга
  tree: sheet('tree', 32, 40),
  pine: sheet('pine', 24, 40),
  birch: sheet('birch', 24, 44),
  bush: sheet('bush', 16, 12),
  stump: sheet('stump', 16, 14),
  log: sheet('log', 24, 10),
  rock: sheet('rock', 16, 10),
  mushroom: sheet('mushroom', 8, 8),
  flower: sheet('flower', 8, 8),
  grassTuft: sheet('grass-tuft', 10, 7),
  fern: sheet('fern', 16, 10),
  // огород, дорога, мельница, звери
  fence: sheet('fence', 32, 14),
  busStop: sheet('bus-stop', 40, 34),
  crops: sheet('crops', 12, 10),
  windmill: sheet('windmill', 48, 64, 13),
  scarecrow: sheet('scarecrow', 20, 30),
  signpost: sheet('signpost', 16, 22),
  duck: sheet('duck', 12, 10),
  bird: sheet('bird', 10, 7),
  butterfly: sheet('butterfly', 7, 6),
  // пасхалки
  hut: sheet('hut', 40, 52, 13),
  bear: sheet('bear', 28, 28),
  campfire: sheet('campfire', 16, 16),
  well: sheet('well', 24, 28),
  outhouse: sheet('outhouse', 18, 30),
  fairyStone: sheet('fairy-stone', 28, 20),
  fisherman: sheet('fisherman', 32, 28),
};
type Sheets = Record<keyof typeof SHEETS, SpriteSheet>;

/** Плитки: повторяются по полу и стенам. */
const TILE_TEXTURES = ['grass', 'planks', 'logs', 'carpet', 'stone', 'water'] as const;
/** Картинки на гранях объёмных моделей (машины, порталы): по одной на грань, без повтора. */
const MODEL_TEXTURES = [...VEHICLE_TEXTURES, ...PORTAL_TEXTURES] as const;
type TextureName = (typeof TILE_TEXTURES)[number] | (typeof MODEL_TEXTURES)[number];

async function loadTextures() {
  const [tiles, models] = await Promise.all([
    Promise.all(TILE_TEXTURES.map((name) => loadTileTexture(textureUrl(name)))),
    Promise.all(MODEL_TEXTURES.map((name) => loadPixelTexture(textureUrl(name)))),
  ]);
  const names = [...TILE_TEXTURES, ...MODEL_TEXTURES];
  const textures = [...tiles, ...models];
  return Object.fromEntries(names.map((name, i) => [name, textures[i]])) as Record<TextureName, THREE.Texture>;
}

/** Сама игра: собирает мир, дорожку, баню и соседей и крутит игровой цикл. */
export class Game implements GameContext {
  readonly scene = new THREE.Scene();
  readonly labels: LabelLayer;
  readonly audio: AudioManager;
  readonly hud: Hud;
  readonly fx: Effects;
  readonly save: SaveData;
  readonly world: World;
  readonly player: Player;
  readonly rng = new Rng(Date.now());
  time = 0;

  private readonly container: HTMLElement;
  private readonly platform: Platform;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cameraRig = new FollowCamera(CAMERA);
  private readonly input: Input;
  private readonly characterSheets: ReadonlyMap<string, SpriteSheet>;
  private readonly sparkleSheet: SpriteSheet;
  private readonly home: Home;
  private readonly carpet: Carpet;
  private readonly neighborhood: Neighborhood;
  private readonly landmarks: Landmarks;
  private readonly broom: Broom;
  private readonly menus: Menus;
  private readonly resizeObserver: ResizeObserver;
  private lastFrame: number | null = null;
  private pausedByPlatform = false;
  /** Идёт реклама — игра и звук на паузе. */
  private adPlaying = false;
  private hidden = document.hidden;
  private dirty = false;
  private urgentSave = false;
  private lastSave = 0;
  private tutorialLabel: Label | null = null;
  /** Фоновая мелодия синтезируется понемногу в каждом кадре, пока не будет готова. */
  private musicJob: Generator<void, Float32Array, void> | null = renderSongGradually(BANYA_POLKA, MUSIC_SAMPLE_RATE);
  /** Игрок уже касался экрана или клавиш — браузер разрешил звук. */
  private gestureSeen = false;
  /** Фоновая мелодия притихла, пока звучит трек редкого персонажа или балалайка медведя. */
  private musicDucked = false;
  private dustTimer = 0;

  /** Загружает всё нужное и собирает игру внутри container. */
  static async create(container: HTMLElement, platform: Platform): Promise<Game> {
    // обычный и золотой лист каждого персонажа: ключи «id» и «id:gold»
    const characterDefs = Object.fromEntries(
      CHARACTERS.flatMap((c) => [
        [c.id, { url: c.sprite, frameWidth: 32, frameHeight: 32, pixelsPerUnit: CHARACTER_PPU }],
        [`${c.id}:gold`, { url: c.goldSprite, frameWidth: 32, frameHeight: 32, pixelsPerUnit: CHARACTER_PPU }],
      ]),
    );
    const [sheets, characterSheets, textures, raw] = await Promise.all([
      loadSpriteSheets(SHEETS),
      loadSpriteSheets(characterDefs),
      loadTextures(),
      platform.loadData(),
    ]);
    const audio = new AudioManager();
    const sounds: [string, string][] = [[RARE_THEME, rareThemeUrl], ...CHARACTERS.flatMap((c): [string, string][] => (c.sound ? [[c.id, c.sound.url]] : []))];
    await Promise.all(
      sounds.map(([id, url]) =>
        audio.load(id, url, { normalizeTo: AUDIO.normalizeTo }).catch((error) => console.warn(`Звук ${id} не загрузился:`, error)),
      ),
    );
    const save = parseSave(raw, new Set(CHARACTERS.map((c) => c.id)));
    return new Game(container, platform, sheets, new Map(Object.entries(characterSheets)), textures, audio, save);
  }

  private constructor(
    container: HTMLElement,
    platform: Platform,
    sheets: Sheets,
    characterSheets: ReadonlyMap<string, SpriteSheet>,
    textures: Awaited<ReturnType<typeof loadTextures>>,
    audio: AudioManager,
    save: SaveData,
  ) {
    this.container = container;
    this.platform = platform;
    this.characterSheets = characterSheets;
    this.sparkleSheet = sheets.sparkle;
    this.audio = audio;
    this.save = save;
    // лучший доход, по которому растут соседи, — не меньше того, что уже на полке
    save.stats.peakIncome = Math.max(save.stats.peakIncome, baseIncome(save));

    this.renderer = new THREE.WebGLRenderer({ antialias: false });
    container.append(this.renderer.domElement);
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, FOG.near, FOG.far);
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6a8f5a', 2.2));
    const sun = new THREE.DirectionalLight('#fff1d6', 1.8);
    sun.position.set(-4, 10, 6);
    this.scene.add(sun);

    this.world = buildWorld(this.scene, textures, sheets);
    this.labels = new LabelLayer(container);
    this.player = new Player(sheets.hero);
    this.player.position.set(PLAYER.start.x, 0, PLAYER.start.z);
    this.scene.add(this.player.root);
    this.cameraRig.jumpTo(this.player.position);

    this.input = new Input(container);
    this.input.onFirstGesture(() => {
      this.gestureSeen = true;
      this.audio.unlock();
      this.startMusic();
    });
    for (const [code, menu] of Object.entries(MENU_KEYS)) this.input.onKey(code, () => this.menus.toggle(menu));
    this.input.onKey('Escape', () => this.menus.close());
    this.hud = new Hud(container, spriteUrl('coin'), {
      onAction: () => this.input.queueAction(),
      onAttack: () => this.input.queueAttack(),
      onMenu: (menu) => this.menus.toggle(menu),
      onToggleMute: () => this.toggleMute(),
      onToggleMusic: () => this.toggleMusic(),
    });
    this.fx = new Effects(this.scene, sheets, this.labels, this.hud, this.cameraRig);
    this.audio.setVolume(AUDIO.master);
    this.audio.setMuted(this.save.muted);
    this.hud.setMuted(this.save.muted);
    this.hud.setMusic(this.save.music);

    this.home = new Home(this, sheets.plate);
    this.landmarks = new Landmarks(this, sheets, textures);
    this.neighborhood = new Neighborhood(this, this.home, {
      bots: [sheets.neighborGreen, sheets.neighborPurple],
      dogs: [sheets.dogBrown, sheets.dogBlack],
      broom: sheets.broom,
      bell: sheets.bell,
    });
    this.carpet = new Carpet(this, this.home, new Spawner(this.rng, CHARACTERS, CARPET.spawnInterval));
    this.carpet.prefill();
    this.broom = new Broom(this, sheets.broom);
    this.menus = new Menus(container, this, this.home, () => this.showRewardedAd());

    platform.onPause(() => this.setPausedByPlatform(true));
    platform.onResume(() => this.setPausedByPlatform(false));
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.onPageHide);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.updateTutorial();
  }

  start(): void {
    this.renderer.setAnimationLoop(this.frame);
    this.platform.gameplayStart();
  }

  // ---------------------------------------------------------------- игровой цикл

  private readonly frame = (now: number): void => {
    const dt = this.lastFrame === null ? 0 : Math.min((now - this.lastFrame) / 1000, MAX_DT);
    this.lastFrame = now;
    if (this.paused) return;
    this.update(dt);
    this.renderer.render(this.scene, this.cameraRig.camera);
    this.labels.update(this.cameraRig.camera, this.container.clientWidth, this.container.clientHeight);
  };

  private update(dt: number): void {
    this.time += dt;
    const zoom = this.input.consumeZoom();
    if (zoom) this.cameraRig.zoom(zoom);

    const speed = this.neighborhood.speedFactor * speedMultiplier(this.save.upgrades);
    this.player.update(dt, this.input.move, this.cameraRig.yawRadians, this.neighborhood.playerObstacles(), speed);
    this.broom.update(dt);
    this.carpet.update(dt);
    this.home.update(dt);
    this.neighborhood.update(dt);
    this.landmarks.update(dt);
    this.world.update(dt, this.player.position);
    this.fx.update(dt);
    this.updateDust(dt);
    if (this.save.tutorial === 0 && !this.carpet.tutorialWalker) this.carpet.spawnTutorialWalker();
    // лучший доход растёт — соседи прокачиваются вслед за ним
    this.save.stats.peakIncome = Math.max(this.save.stats.peakIncome, baseIncome(this.save));

    if (this.input.consumeAttack()) this.attack();
    const action: Action | null =
      this.findHitAction() ??
      this.home.findAction() ??
      this.neighborhood.findAction() ??
      this.carpet.findAction(this.neighborhood.isCarrying) ??
      this.landmarks.findAction();
    this.hud.setAction(action?.view ?? null);
    if (this.input.consumeAction()) {
      if (action?.view.enabled) action.run();
      else if (action) this.audio.blip('error');
    }

    const clock = Date.now();
    this.hud.setWallet(this.save.coins, totalIncome(this.save, clock));
    this.hud.setBoost(this.save.boostUntil - clock);
    this.hud.setBroom(this.broom.recharge, !this.neighborhood.isCarrying && !this.player.isStunned);
    // пока открыто окно, соседи не начинают новых набегов
    this.neighborhood.raidsPaused = this.menus.open !== null;
    this.menus.update();
    this.continueMusicJob();
    this.updateMusic();
    this.cameraRig.update(dt, this.player.position);
    this.updateTutorialPointer();
    this.maybeSave();
  }

  /** Пыль из-под ног, пока герой бежит. */
  private updateDust(dt: number): void {
    this.dustTimer -= dt;
    const move = this.input.move;
    if (this.dustTimer > 0 || this.player.isStunned || Math.hypot(move.x, move.y) < 0.5) return;
    this.dustTimer = DUST_INTERVAL;
    const facing = this.player.facing;
    this.fx.dust(this.player.position.clone().add(new THREE.Vector3(-facing.x * 0.3, 0, -facing.z * 0.3)));
  }

  // ---------------------------------------------------------------- веник

  /** Удар веником: оглушает соседей и прогоняет собак рядом. С добычей на руках бить нельзя. */
  private attack(): void {
    if (this.player.isStunned) return;
    if (this.neighborhood.isCarrying) {
      this.hud.showBanner('Руки заняты — сначала донеси добычу', '#ffcd75', 1500);
      return;
    }
    if (!this.broom.ready) return;
    this.broom.swing();
    this.neighborhood.hitAround(this.player.position, BROOM.range, broomStun(this.save.upgrades));
  }

  /** Если рядом враждебный сосед или собака — главная кнопка тоже бьёт веником. */
  private findHitAction(): Action | null {
    if (this.neighborhood.isCarrying || this.player.isStunned) return null;
    const target = this.neighborhood.hostileNear(this.player.position, BROOM.range, broomStun(this.save.upgrades));
    if (!target) return null;
    return {
      view: this.broom.ready
        ? { title: 'Шлёпнуть веником', detail: target.detail, enabled: true }
        : { title: 'Шлёпнуть веником', detail: 'веник перезаряжается…', enabled: false },
      run: () => this.attack(),
    };
  }

  // ---------------------------------------------------------------- реклама

  /** Реклама за награду: на время показа игра и звук на паузе. true — награду нужно выдать. */
  private async showRewardedAd(): Promise<boolean> {
    this.adPlaying = true;
    this.applyPause();
    try {
      return await this.platform.showRewardedAd();
    } catch (error) {
      console.warn('Реклама не показалась:', error);
      return false;
    } finally {
      this.adPlaying = false;
      this.applyPause();
    }
  }

  // ---------------------------------------------------------------- GameContext

  createBrainrot(def: CharacterDef, gold = false): Brainrot {
    const characterSheet = this.characterSheets.get(gold ? `${def.id}:gold` : def.id);
    if (!characterSheet) throw new Error(`Нет спрайта для персонажа ${def.id}`);
    const brainrot = new Brainrot(def, characterSheet, gold, this.sparkleSheet);
    this.scene.add(brainrot.root);
    return brainrot;
  }

  removeBrainrot(brainrot: Brainrot): void {
    this.scene.remove(brainrot.root);
    brainrot.label?.remove();
    brainrot.label = null;
    brainrot.dispose();
  }

  playVoice(def: CharacterDef): void {
    if (def.sound) this.audio.play(def.id, { offset: def.sound.offset, duration: def.sound.duration, volume: AUDIO.voice });
  }

  markDirty(urgent = false): void {
    this.dirty = true;
    this.urgentSave ||= urgent;
  }

  tutorialEvent(event: TutorialEvent): void {
    const step = this.save.tutorial;
    if (event === 'bought' && step === 0) this.save.tutorial = 1;
    else if (event === 'collected' && step === 1) {
      this.save.tutorial = 2;
      this.hud.showBanner('Отлично! Копи на персонажей подороже');
    } else if (event === 'stolen' && step === 2) {
      this.save.tutorial = TUTORIAL_DONE;
      this.hud.showBanner('Соседи тоже будут красть — закрывай баню и бей воров веником!', '#ffcd75', 4500);
    } else return;
    this.updateTutorial();
    this.markDirty(true);
  }

  // ---------------------------------------------------------------- обучение

  private updateTutorial(): void {
    if (this.save.tutorial >= TUTORIAL_DONE) {
      this.tutorialLabel?.remove();
      this.tutorialLabel = null;
      return;
    }
    if (!this.tutorialLabel) {
      this.tutorialLabel = this.labels.create('tutorial-pointer');
      this.tutorialLabel.pinToEdge = true;
    }
  }

  private updateTutorialPointer(): void {
    const label = this.tutorialLabel;
    if (!label) return;
    let text = '';
    const target = new THREE.Vector3();
    switch (this.save.tutorial) {
      case 0: {
        const walker = this.carpet.tutorialWalker;
        if (walker) {
          text = 'Купи меня!';
          target.set(walker.position.x, 3.1, walker.position.z);
        }
        break;
      }
      case 1: {
        const slot = this.home.residents.findIndex((r) => r?.state === 'seated');
        if (slot >= 0) {
          text = 'Встань сюда — собери монеты';
          target.copy(this.home.platePosition(slot)).setY(1.6);
        }
        break;
      }
      case 2: {
        if (this.neighborhood.isCarrying) {
          text = 'Неси в свою баню!';
          target.copy(this.world.home.entrance).setY(2);
        } else if (this.home.seatedCount >= 2) {
          const victim = this.neighborhood.tutorialTarget();
          if (victim) {
            text = 'Укради у соседа!';
            target.set(victim.position.x, 3.3, victim.position.z);
          }
        }
        break;
      }
    }
    label.visible = text !== '';
    if (!text) return;
    if (label.element.textContent !== text) label.element.textContent = text;
    label.anchor.copy(target);
  }

  // ---------------------------------------------------------------- музыка

  /** Фоновая мелодия: включается после первого касания и плавно появляется. */
  private startMusic(): void {
    if (!this.save.music || this.musicJob || !this.gestureSeen || this.audio.isPlaying(BACKGROUND_MUSIC)) return;
    this.audio.play(BACKGROUND_MUSIC, { loop: true, volume: this.musicDucked ? 0 : AUDIO.music, fadeIn: 4 });
  }

  /** Синтез мелодии — не дольше нескольких миллисекунд за кадр, чтобы игра не подвисала. */
  private continueMusicJob(): void {
    if (!this.musicJob) return;
    const deadline = performance.now() + MUSIC_JOB_BUDGET_MS;
    while (performance.now() < deadline) {
      const result = this.musicJob.next();
      if (!result.done) continue;
      this.musicJob = null;
      this.audio.addSamples(BACKGROUND_MUSIC, result.value, MUSIC_SAMPLE_RATE, { normalizeTo: AUDIO.normalizeTo });
      this.startMusic();
      return;
    }
  }

  private toggleMusic(): void {
    this.save.music = !this.save.music;
    this.hud.setMusic(this.save.music);
    if (this.save.music) {
      this.startMusic();
    } else {
      this.audio.stop(BACKGROUND_MUSIC, 1);
      this.audio.stop(RARE_THEME, 1);
    }
    this.markDirty(true);
  }

  /** Пока звучит трек редкого персонажа или балалайка, фоновая мелодия плавно затихает, потом возвращается. */
  private updateMusic(): void {
    const other = this.audio.isPlaying(RARE_THEME) || this.audio.isPlaying(BEAR_TUNE_ID);
    if (other === this.musicDucked) return;
    this.musicDucked = other;
    this.audio.fadeTo(BACKGROUND_MUSIC, other ? 0 : AUDIO.music, other ? 1.2 : 4);
  }

  // ---------------------------------------------------------------- сохранение, пауза, звук

  private maybeSave(): void {
    if (totalIncome(this.save, Date.now()) > 0) this.dirty = true;
    if (!this.dirty) return;
    const now = performance.now();
    const interval = this.urgentSave ? this.platform.minSaveInterval : PASSIVE_SAVE_INTERVAL;
    if (now - this.lastSave >= interval) this.flushSave();
  }

  private readonly flushSave = (): void => {
    this.dirty = false;
    this.urgentSave = false;
    this.lastSave = performance.now();
    this.save.savedAt = Date.now();
    this.platform.saveData(this.save).catch((error) => console.warn('Не удалось сохранить прогресс:', error));
  };

  private toggleMute(): void {
    this.save.muted = !this.save.muted;
    this.audio.setMuted(this.save.muted);
    this.hud.setMuted(this.save.muted);
    this.markDirty(true);
  }

  private setPausedByPlatform(paused: boolean): void {
    this.pausedByPlatform = paused;
    this.applyPause();
  }

  private readonly onVisibilityChange = (): void => {
    this.hidden = document.hidden;
    if (this.hidden) {
      // награда из кейса или колеса не должна пропасть, если вкладку свернули посреди анимации
      this.menus.settle();
      this.flushSave();
    }
    this.applyPause();
  };

  private readonly onPageHide = (): void => {
    this.menus.settle();
    this.flushSave();
  };

  /** Игра стоит: площадка попросила паузу, идёт реклама или вкладка свёрнута. */
  private get paused(): boolean {
    return this.pausedByPlatform || this.adPlaying || this.hidden;
  }

  private applyPause(): void {
    const paused = this.paused;
    this.audio.setPaused(paused);
    if (paused) this.platform.gameplayStop();
    else this.platform.gameplayStart();
    this.lastFrame = null;
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    const shortSide = Math.min(width, height);
    const ratio = RENDER_SHORT_SIDE > 0 ? Math.min(RENDER_SHORT_SIDE / shortSide, window.devicePixelRatio) : window.devicePixelRatio;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height);
    this.cameraRig.setAspect(width / height);
  }

  /** Для отладки из консоли браузера (только в режиме разработки). */
  get debug() {
    return {
      save: this.save,
      player: this.player,
      carpet: this.carpet,
      home: this.home,
      neighborhood: this.neighborhood,
      landmarks: this.landmarks,
      broom: this.broom,
      menus: this.menus,
      audio: this.audio,
      game: this,
    };
  }
}
