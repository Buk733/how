// Мягкие клубы пара и дыма: полупрозрачные спрайты, которые растут, поднимаются и плавно тают —
// без резкого появления и исчезновения. Картинка клуба белая (sprites/puff.png, 4 формы),
// цвет и прозрачность задаёт «вид» клуба: пар — белый, дым — серый.
import * as THREE from 'three';
import type { SpriteSheet } from '@engine/sprite';

/** Как выглядит клуб. */
export interface PuffLook {
  readonly color: THREE.ColorRepresentation;
  /** Наибольшая непрозрачность. */
  readonly opacity: number;
  /** Размер при появлении и в конце жизни, единицы мира. */
  readonly size: readonly [number, number];
}

interface Puff {
  readonly sprite: THREE.Sprite;
  readonly material: THREE.SpriteMaterial;
  readonly velocity: THREE.Vector3;
  age: number;
  life: number;
  /** Своя фаза покачивания — клубы не качаются строем. */
  phase: number;
  look: PuffLook;
  active: boolean;
}

/** Скорость гаснет за секунду во столько раз — клуб «вязнет» в воздухе. */
const DRAG = 0.55;
/** Как широко клубы раскачиваются из стороны в сторону, единиц в секунду. */
const SWAY = 0.18;

/** Пул мягких клубов: спрайты создаются один раз и переиспользуются; свободных нет — берётся самый старый. */
export class PuffPool {
  private readonly puffs: Puff[] = [];
  private readonly shapes: THREE.Texture[] = [];

  constructor(scene: THREE.Scene, sheet: SpriteSheet, size: number) {
    // по текстуре на форму клуба (картинка общая): у клуба своя прозрачность, а значит, свой материал
    for (let i = 0; i < sheet.columns; i++) {
      const texture = sheet.texture.clone();
      texture.repeat.set(1 / sheet.columns, 1);
      texture.offset.set(i / sheet.columns, 0);
      this.shapes.push(texture);
    }
    for (let i = 0; i < size; i++) {
      const material = new THREE.SpriteMaterial({ map: this.shapes[i % this.shapes.length], transparent: true, depthWrite: false, opacity: 0 });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      scene.add(sprite);
      this.puffs.push({ sprite, material, velocity: new THREE.Vector3(), age: 0, life: 1, phase: 0, look: { color: '#ffffff', opacity: 0, size: [1, 1] }, active: false });
    }
  }

  emit(at: THREE.Vector3, velocity: THREE.Vector3, life: number, look: PuffLook): void {
    const puff = this.puffs.find((p) => !p.active) ?? this.puffs.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    puff.sprite.position.copy(at);
    puff.velocity.copy(velocity);
    puff.age = 0;
    puff.life = life;
    puff.phase = Math.random() * Math.PI * 2;
    puff.look = look;
    puff.active = true;
    puff.material.map = this.shapes[Math.floor(Math.random() * this.shapes.length)];
    puff.material.color.set(look.color);
    puff.material.opacity = 0;
    puff.sprite.visible = true;
    this.shape(puff);
  }

  update(dt: number): void {
    const drag = Math.pow(DRAG, dt);
    for (const puff of this.puffs) {
      if (!puff.active) continue;
      puff.age += dt;
      if (puff.age >= puff.life) {
        puff.active = false;
        puff.sprite.visible = false;
        continue;
      }
      puff.velocity.multiplyScalar(drag);
      puff.sprite.position.addScaledVector(puff.velocity, dt);
      puff.sprite.position.x += Math.sin(puff.age * 2.2 + puff.phase) * SWAY * dt;
      this.shape(puff);
    }
  }

  /** Размер и прозрачность по возрасту: быстро проявляется, растёт и долго тает. */
  private shape(puff: Puff): void {
    const t = puff.age / puff.life;
    const [from, to] = puff.look.size;
    const size = from + (to - from) * (1 - (1 - t) * (1 - t));
    puff.sprite.scale.set(size, size, 1);
    const fadeIn = Math.min(1, t / 0.18);
    const fadeOut = 1 - smoothstep(0.3, 1, t);
    puff.material.opacity = puff.look.opacity * fadeIn * fadeOut;
  }
}

/** Откуда и как часто идут клубы. */
export interface PuffSourceOptions {
  /** Клубов в секунду. */
  readonly rate: number;
  /** Сколько живёт клуб, секунды. */
  readonly life: number;
  /** Начальная скорость (x, y, z) — потом клуб вязнет в воздухе. */
  readonly velocity: readonly [number, number, number];
  /** Разброс места появления, единицы мира. */
  readonly spread: number;
  readonly look: PuffLook;
}

/** Постоянный источник клубов: пар над каменкой, дым из трубы. */
export class PuffSource {
  private readonly pool: PuffPool;
  private readonly origin: THREE.Vector3;
  private readonly options: PuffSourceOptions;
  private timer = 0;
  private readonly at = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();

  constructor(pool: PuffPool, origin: THREE.Vector3, options: PuffSourceOptions) {
    this.pool = pool;
    this.origin = origin;
    this.options = options;
    this.timer = Math.random() / options.rate;
  }

  update(dt: number): void {
    const { rate, life, velocity, spread, look } = this.options;
    this.timer -= dt;
    while (this.timer <= 0) {
      // неровный ритм: клубы идут то чаще, то реже
      this.timer += (0.6 + Math.random() * 0.8) / rate;
      this.at.set(this.origin.x + (Math.random() - 0.5) * spread, this.origin.y, this.origin.z + (Math.random() - 0.5) * spread * 0.5);
      this.velocity.set(velocity[0] * (0.7 + Math.random() * 0.6), velocity[1] * (0.8 + Math.random() * 0.4), velocity[2]);
      this.pool.emit(this.at, this.velocity, life * (0.85 + Math.random() * 0.3), look);
    }
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
