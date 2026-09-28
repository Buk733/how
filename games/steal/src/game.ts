import * as THREE from 'three';
import { loadSpriteSheets, loadTileTexture } from '@engine/assets';
import { AudioManager } from '@engine/audio';
import { FollowCamera } from '@engine/camera';
import { formatNumber } from '@engine/format';
import { Input } from '@engine/input';
import { LabelLayer, type Label } from '@engine/labels';
import { distanceXZ } from '@engine/math';
import type { Platform } from '@engine/platform/platform';
import { Rng } from '@engine/rng';
import type { SpriteSheet, SpriteSheetDef } from '@engine/sprite';
import { BUY_RANGE, CAMERA, CARPET, ECONOMY, FOG, PLATE_RADIUS, PLAYER, RENDER_SHORT_SIDE, SKY_COLOR } from './config';
import { CHARACTERS, type CharacterDef } from './data/characters';
import { RARITIES, RARITY_ORDER } from './data/rarity';
import { checkPurchase, sellValue, totalIncome, unlockCost } from './economy';
import { Brainrot } from './entities/brainrot';
import { Player } from './entities/player';
import { Plate } from './entities/plate';
import { parseSave, type SaveData } from './save';
import { Spawner } from './spawner';
import { Hud, type ActionView } from './ui/hud';
import { buildWorld, type World } from './world';
import heroUrl from './assets/sprites/hero.png';
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

/** Сама игра: мир, персонажи, экономика и игровой цикл. */
export class Game {
  private readonly container: HTMLElement;
  private readonly platform: Platform;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly cameraRig = new FollowCamera(CAMERA);
  private readonly input: Input;
  private readonly audio: AudioManager;
  private readonly labels: LabelLayer;
  private readonly hud: Hud;
  private readonly world: World;
  private readonly characterSheets: ReadonlyMap<string, SpriteSheet>;
  private readonly player: Player;
  private readonly spawner: Spawner;
  private readonly save: SaveData;
  private readonly walkers: Brainrot[] = [];
  private readonly residents: (Brainrot | null)[];
  private readonly plates: Plate[];
  private readonly resizeObserver: ResizeObserver;
  private time = 0;
  private lastFrame: number | null = null;
  private pausedByPlatform = false;
  private hidden = document.hidden;
  private dirty = false;
  private urgentSave = false;
  private lastSave = 0;
  private lastCollectText = 0;
  private tutorialLabel: Label | null = null;
  private tutorialWalker: Brainrot | null = null;

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
    await Promise.all(
      CHARACTERS.flatMap((c) =>
        c.sound ? [audio.load(c.id, c.sound.url).catch((error) => console.warn(`Звук ${c.id} не загрузился:`, error))] : [],
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
    const sign = this.labels.create('world-sign');
    sign.element.textContent = 'ТВОЯ БАНЯ';
    sign.anchor.copy(this.world.signAnchor);

    this.plates = this.world.plates.map((position) => {
      const plate = new Plate(sheets.plate, position, this.labels.create('plate-tag'));
      this.scene.add(plate.mesh);
      return plate;
    });

    this.residents = this.save.slots.map((slot, i) => {
      const def = slot.id ? CHARACTERS.find((c) => c.id === slot.id) : undefined;
      if (!def) return null;
      const resident = this.createBrainrot(def);
      resident.seatAt(i, this.world.seats[i]);
      return resident;
    });

    this.player = new Player(sheets.hero);
    this.player.position.set(PLAYER.start.x, 0, PLAYER.start.z);
    this.scene.add(this.player.root);
    this.cameraRig.jumpTo(this.player.position);

    this.spawner = new Spawner(new Rng(Date.now()), CHARACTERS, CARPET.spawnInterval);

    this.input = new Input(container);
    this.input.onFirstGesture(() => this.audio.unlock());
    this.hud = new Hud(container, coinUrl, {
      onAction: () => this.input.queueAction(),
      onToggleMute: () => this.toggleMute(),
    });
    this.audio.setMuted(this.save.muted);
    this.hud.setMuted(this.save.muted);
    this.prefillCarpet();

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

    this.player.update(dt, this.input.move, this.cameraRig.yawRadians, this.world);
    this.updateCarpet(dt);
    this.updateResidents(dt);
    this.world.update(dt);

    const action = this.findAction();
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

  private updateCarpet(dt: number): void {
    const next = this.spawner.update(dt);
    if (next && this.walkers.length < CARPET.maxWalkers) this.spawnWalker(next, CARPET.startX);

    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const walker = this.walkers[i];
      walker.update(dt);
      if (walker.label) {
        walker.label.anchor.set(walker.position.x, walker.position.y + 2.05, walker.position.z);
        walker.label.element.classList.toggle('cant-afford', this.save.coins < walker.def.price);
      }
      if (walker.gone) {
        this.removeBrainrot(walker);
        this.walkers.splice(i, 1);
        if (walker === this.tutorialWalker) this.tutorialWalker = null;
      }
    }
    if (this.save.tutorial === 0 && !this.tutorialWalker) this.spawnTutorialWalker();
  }

  private updateResidents(dt: number): void {
    for (let i = 0; i < this.residents.length; i++) {
      const resident = this.residents[i];
      const slot = this.save.slots[i];
      const plate = this.plates[i];
      if (resident) {
        const wasSeated = resident.state === 'seated';
        resident.update(dt);
        if (resident.state === 'seated') {
          slot.stored += resident.def.income * dt;
          if (!wasSeated) this.updateTutorial();
        }
      }

      if (i >= this.save.unlocked) {
        plate.setState('locked');
        const cost = unlockCost(i);
        plate.setText(i === this.save.unlocked && cost !== null ? `🔒 ${formatNumber(cost)}` : '');
        continue;
      }
      const stored = Math.floor(slot.stored);
      plate.setState(stored > 0 ? 'ready' : 'empty');
      plate.setText(resident ? `💰 ${formatNumber(stored)}` : '');

      if (stored > 0 && distanceXZ(this.player.position, plate.mesh.position) < PLATE_RADIUS) this.collect(i, stored);
    }
  }

  // ---------------------------------------------------------------- действия игрока

  private findAction(): { view: ActionView; run: () => void } | null {
    // Стоим на следующем закрытом месте — можно его открыть.
    const next = this.save.unlocked;
    const cost = unlockCost(next);
    if (cost !== null && distanceXZ(this.player.position, this.plates[next].mesh.position) < PLATE_RADIUS + 0.3) {
      return {
        view: { title: 'Открыть место', detail: `💰 ${formatNumber(cost)}`, enabled: this.save.coins >= cost },
        run: () => this.unlockSlot(next, cost),
      };
    }

    // Ближайший персонаж на дорожке.
    let nearest: Brainrot | null = null;
    let nearestDistance = BUY_RANGE;
    for (const walker of this.walkers) {
      const distance = distanceXZ(this.player.position, walker.position);
      if (walker.state === 'walking' && distance < nearestDistance) {
        nearest = walker;
        nearestDistance = distance;
      }
    }
    if (!nearest) return null;
    const target = nearest;
    const check = checkPurchase(this.save, target.def);
    const detail = check.ok
      ? check.replaces
        ? `💰 ${formatNumber(target.def.price)} · заменит «${check.replaces.name}»`
        : `💰 ${formatNumber(target.def.price)}`
      : check.reason === 'coins'
        ? `нужно 💰 ${formatNumber(target.def.price)}`
        : 'нет мест — открой новое';
    return {
      view: { title: `Купить «${target.def.name}»`, detail, enabled: check.ok },
      run: () => this.buy(target),
    };
  }

  private buy(walker: Brainrot): void {
    const check = checkPurchase(this.save, walker.def);
    if (!check.ok) return;
    this.save.coins -= walker.def.price;
    this.save.stats.bought++;

    const old = this.residents[check.slot];
    const oldSlot = this.save.slots[check.slot];
    if (old) {
      const refund = sellValue(old.def) + Math.floor(oldSlot.stored);
      this.save.coins += refund;
      this.labels.float(`+${formatNumber(refund)}`, old.position.clone().setY(1.8), 'float-coins');
      this.removeBrainrot(old);
    }
    this.save.slots[check.slot] = { id: walker.def.id, stored: 0 };

    this.walkers.splice(this.walkers.indexOf(walker), 1);
    walker.label?.remove();
    walker.label = null;
    this.residents[check.slot] = walker;
    const seat = this.world.seats[check.slot];
    const plate = this.world.plates[check.slot];
    walker.sendTo(check.slot, [
      this.world.entrance.clone().setX(walker.position.x * 0.3),
      new THREE.Vector3(plate.x, 0, plate.z + 0.6),
      seat,
    ]);

    this.playCharacterSound(walker.def);
    this.audio.blip('buy');
    this.labels.float(`-${formatNumber(walker.def.price)}`, walker.position.clone().setY(2), 'float-spend');
    if (walker === this.tutorialWalker) this.tutorialWalker = null;
    if (this.save.tutorial === 0) this.save.tutorial = 1;
    this.updateTutorial();
    this.markDirty(true);
  }

  private collect(slotIndex: number, amount: number): void {
    const slot = this.save.slots[slotIndex];
    slot.stored -= amount;
    this.save.coins += amount;
    this.save.stats.earned += amount;
    if (this.time - this.lastCollectText > 0.35) {
      this.lastCollectText = this.time;
      this.labels.float(`+${formatNumber(amount)}`, this.plates[slotIndex].mesh.position.clone().setY(1.2), 'float-coins');
      this.audio.blip('coin');
    }
    if (this.save.tutorial === 1) {
      this.save.tutorial = 2;
      this.updateTutorial();
      this.hud.showBanner('Отлично! Копи на персонажей подороже');
    }
    this.markDirty(true);
  }

  private unlockSlot(index: number, cost: number): void {
    if (this.save.coins < cost || index !== this.save.unlocked) return;
    this.save.coins -= cost;
    this.save.unlocked++;
    this.audio.blip('unlock');
    this.hud.showBanner('Новое место на полке!', '#a7f070');
    this.markDirty(true);
  }

  // ---------------------------------------------------------------- персонажи

  private createBrainrot(def: CharacterDef): Brainrot {
    const sheetForCharacter = this.characterSheets.get(def.id);
    if (!sheetForCharacter) throw new Error(`Нет спрайта для персонажа ${def.id}`);
    const brainrot = new Brainrot(def, sheetForCharacter);
    this.scene.add(brainrot.root);
    return brainrot;
  }

  private spawnWalker(def: CharacterDef, x: number): Brainrot {
    const walker = this.createBrainrot(def);
    walker.position.set(x, 0, CARPET.z);
    const rarity = RARITIES[def.rarity];
    const label = this.labels.create('walker-tag');
    const name = document.createElement('b');
    const rarityName = document.createElement('i');
    const price = document.createElement('span');
    name.textContent = def.name;
    name.style.color = rarity.color;
    rarityName.textContent = rarity.name;
    price.textContent = `💰 ${formatNumber(def.price)} · +${formatNumber(def.income)}/с`;
    label.element.append(name, rarityName, price);
    walker.label = label;
    this.walkers.push(walker);

    if (RARITY_ORDER.indexOf(def.rarity) >= RARITY_ORDER.indexOf('legendary')) {
      this.hud.showBanner(`На дорожке ${rarity.name.toLowerCase()} «${def.name}»!`, rarity.color, 3500);
      this.audio.blip('unlock');
    }
    return walker;
  }

  private removeBrainrot(brainrot: Brainrot): void {
    this.scene.remove(brainrot.root);
    brainrot.label?.remove();
    brainrot.dispose();
    const slot = this.residents.indexOf(brainrot);
    if (slot >= 0) this.residents[slot] = null;
  }

  /** Чтобы дорожка не была пустой в первые секунды. */
  private prefillCarpet(): void {
    const span = CARPET.endX - CARPET.startX;
    for (let i = 0; i < 6; i++) this.spawnWalker(this.spawner.pick(), CARPET.startX + span * (0.1 + i * 0.15));
  }

  private playCharacterSound(def: CharacterDef): void {
    if (def.sound) this.audio.play(def.id, { offset: def.sound.offset, duration: def.sound.duration });
  }

  // ---------------------------------------------------------------- обучение

  /** Первый персонаж идёт прямо к игроку, и он точно по карману. */
  private spawnTutorialWalker(): void {
    const cheapest = CHARACTERS.reduce((a, b) => (b.price < a.price ? b : a));
    const x = Math.max(CARPET.startX, this.player.position.x - CARPET.walkSpeed * 3);
    // Убираем тех, кто стоит слишком близко: иначе персонажи и подписи наложатся.
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      if (Math.abs(this.walkers[i].position.x - x) < 3.5) {
        this.removeBrainrot(this.walkers[i]);
        this.walkers.splice(i, 1);
      }
    }
    this.tutorialWalker = this.spawnWalker(cheapest, x);
    this.updateTutorial();
  }

  private updateTutorial(): void {
    const step = this.save.tutorial;
    const text = step === 0 ? 'Купи меня!' : step === 1 ? 'Встань сюда — собери монеты' : '';
    if (!text) {
      this.tutorialLabel?.remove();
      this.tutorialLabel = null;
      return;
    }
    if (!this.tutorialLabel) this.tutorialLabel = this.labels.create('tutorial-pointer');
    this.tutorialLabel.element.textContent = text;
  }

  private updateTutorialPointer(): void {
    const label = this.tutorialLabel;
    if (!label) return;
    if (this.save.tutorial === 0) {
      const target = this.tutorialWalker;
      label.visible = target !== null;
      if (target) label.anchor.set(target.position.x, 3.1, target.position.z);
    } else {
      const slot = this.residents.findIndex((r) => r?.state === 'seated');
      label.visible = slot >= 0;
      if (slot >= 0) label.anchor.copy(this.plates[slot].mesh.position).setY(1.6);
    }
  }

  // ---------------------------------------------------------------- сохранение, пауза, звук

  private markDirty(urgent = false): void {
    this.dirty = true;
    this.urgentSave ||= urgent;
  }

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
    this.prefillCarpet();
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
    return { save: this.save, player: this.player, walkers: this.walkers, residents: this.residents, ECONOMY };
  }
}
