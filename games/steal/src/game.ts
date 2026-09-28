import * as THREE from 'three';
import { loadSpriteSheets, loadTileTexture } from '@engine/assets';
import { AudioManager } from '@engine/audio';
import { FollowCamera } from '@engine/camera';
import { Input } from '@engine/input';
import { LabelLayer, type Label } from '@engine/labels';
import type { Platform } from '@engine/platform/platform';
import { Rng } from '@engine/rng';
import type { SpriteSheet, SpriteSheetDef } from '@engine/sprite';
import { Carpet, RARE_THEME } from './carpet';
import { AUDIO, CAMERA, CARPET, FOG, PLAYER, RENDER_SHORT_SIDE, SKY_COLOR } from './config';
import type { Action, GameContext, TutorialEvent } from './context';
import { CHARACTERS, type CharacterDef } from './data/characters';
import { totalIncome } from './economy';
import { Brainrot } from './entities/brainrot';
import { Player } from './entities/player';
import { Home } from './home';
import { Neighborhood } from './neighborhood';
import { parseSave, TUTORIAL_DONE, type SaveData } from './save';
import { Spawner } from './spawner';
import { Hud } from './ui/hud';
import { buildWorld, type World } from './world';
import heroUrl from './assets/sprites/hero.png';
import neighborGreenUrl from './assets/sprites/neighbor-green.png';
import neighborPurpleUrl from './assets/sprites/neighbor-purple.png';
import coinUrl from './assets/sprites/coin.png';
import plateUrl from './assets/sprites/plate.png';
import steamUrl from './assets/sprites/steam.png';
import treeUrl from './assets/sprites/tree.png';
import pineUrl from './assets/sprites/pine.png';
import bushUrl from './assets/sprites/bush.png';
import bucketUrl from './assets/sprites/bucket.png';
import grassUrl from './assets/textures/grass.png';
import planksUrl from './assets/textures/planks.png';
import logsUrl from './assets/textures/logs.png';
import carpetUrl from './assets/textures/carpet.png';
import stoneUrl from './assets/textures/stone.png';
import rareThemeUrl from './sounds/rare-theme.mp3';

/** Самый длинный шаг симуляции: если вкладка «подвисла», мир не прыгнет вперёд. */
const MAX_DT = 0.1;
/** Как часто сохранять накопленные монеты, если игрок ничего не делает, мс. */
const PASSIVE_SAVE_INTERVAL = 10_000;
/** Персонажи 32×32 при 18 px на единицу — чуть выше героя. */
const CHARACTER_PPU = 18;

const sheet = (url: string, frameWidth: number, frameHeight: number, pixelsPerUnit = 16): SpriteSheetDef => ({
  url,
  frameWidth,
  frameHeight,
  pixelsPerUnit,
});

const SHEETS = {
  hero: sheet(heroUrl, 16, 16, 12),
  neighborGreen: sheet(neighborGreenUrl, 16, 16, 12),
  neighborPurple: sheet(neighborPurpleUrl, 16, 16, 12),
  plate: sheet(plateUrl, 16, 16, 11),
  steam: sheet(steamUrl, 8, 8, 10),
  tree: sheet(treeUrl, 32, 40),
  pine: sheet(pineUrl, 24, 40),
  bush: sheet(bushUrl, 16, 12),
  bucket: sheet(bucketUrl, 16, 16, 20),
};
type Sheets = Record<keyof typeof SHEETS, SpriteSheet>;

async function loadTextures() {
  const [grass, planks, logs, carpet, stone] = await Promise.all(
    [grassUrl, planksUrl, logsUrl, carpetUrl, stoneUrl].map((url) => loadTileTexture(url)),
  );
  return { grass, planks, logs, carpet, stone };
}

/** Сама игра: собирает мир, дорожку, баню и соседей и крутит игровой цикл. */
export class Game implements GameContext {
  readonly scene = new THREE.Scene();
  readonly labels: LabelLayer;
  readonly audio: AudioManager;
  readonly hud: Hud;
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
  private readonly home: Home;
  private readonly carpet: Carpet;
  private readonly neighborhood: Neighborhood;
  private readonly resizeObserver: ResizeObserver;
  private lastFrame: number | null = null;
  private pausedByPlatform = false;
  private hidden = document.hidden;
  private dirty = false;
  private urgentSave = false;
  private lastSave = 0;
  private tutorialLabel: Label | null = null;

  /** Загружает всё нужное и собирает игру внутри container. */
  static async create(container: HTMLElement, platform: Platform): Promise<Game> {
    const characterDefs = Object.fromEntries(CHARACTERS.map((c) => [c.id, sheet(c.sprite, 32, 32, CHARACTER_PPU)]));
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
    this.audio = audio;
    this.save = save;

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
    this.input.onFirstGesture(() => this.audio.unlock());
    this.hud = new Hud(container, coinUrl, {
      onAction: () => this.input.queueAction(),
      onToggleMute: () => this.toggleMute(),
    });
    this.audio.setMuted(this.save.muted);
    this.hud.setMuted(this.save.muted);

    this.home = new Home(this, sheets.plate);
    this.neighborhood = new Neighborhood(this, this.home, [sheets.neighborGreen, sheets.neighborPurple]);
    this.carpet = new Carpet(this, this.home, new Spawner(this.rng, CHARACTERS, CARPET.spawnInterval));
    this.carpet.prefill();

    platform.onPause(() => this.setPausedByPlatform(true));
    platform.onResume(() => this.setPausedByPlatform(false));
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.flushSave);

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
    if (this.pausedByPlatform || this.hidden) return;
    this.update(dt);
    this.renderer.render(this.scene, this.cameraRig.camera);
    this.labels.update(this.cameraRig.camera, this.container.clientWidth, this.container.clientHeight);
  };

  private update(dt: number): void {
    this.time += dt;
    const zoom = this.input.consumeZoom();
    if (zoom) this.cameraRig.zoom(zoom);

    this.player.update(dt, this.input.move, this.cameraRig.yawRadians, this.world, this.neighborhood.speedFactor);
    this.carpet.update(dt);
    this.home.update(dt);
    this.neighborhood.update(dt);
    this.world.update(dt);
    if (this.save.tutorial === 0 && !this.carpet.tutorialWalker) this.carpet.spawnTutorialWalker();

    const action: Action | null =
      this.home.findAction() ?? this.neighborhood.findAction() ?? this.carpet.findAction(this.neighborhood.isCarrying);
    this.hud.setAction(action?.view ?? null);
    if (this.input.consumeAction()) {
      if (action?.view.enabled) action.run();
      else if (action) this.audio.blip('error');
    }

    this.hud.setWallet(this.save.coins, totalIncome(this.save));
    this.cameraRig.update(dt, this.player.position);
    this.updateTutorialPointer();
    this.maybeSave();
  }

  // ---------------------------------------------------------------- GameContext

  createBrainrot(def: CharacterDef): Brainrot {
    const characterSheet = this.characterSheets.get(def.id);
    if (!characterSheet) throw new Error(`Нет спрайта для персонажа ${def.id}`);
    const brainrot = new Brainrot(def, characterSheet);
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
      this.hud.showBanner('Соседи тоже будут красть — закрывай баню на щеколду!', '#ffcd75', 4500);
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

  // ---------------------------------------------------------------- сохранение, пауза, звук

  private maybeSave(): void {
    if (totalIncome(this.save) > 0) this.dirty = true;
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
    if (this.hidden) this.flushSave();
    this.applyPause();
  };

  private applyPause(): void {
    const paused = this.pausedByPlatform || this.hidden;
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
    return { save: this.save, player: this.player, carpet: this.carpet, home: this.home, neighborhood: this.neighborhood, game: this };
  }
}
