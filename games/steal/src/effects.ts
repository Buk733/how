import * as THREE from 'three';
import type { FollowCamera } from '@engine/camera';
import type { LabelLayer } from '@engine/labels';
import { BillboardSprite, type SpriteSheet } from '@engine/sprite';
import { PuffPool, type PuffLook } from './puffs';
import type { Hud } from './ui/hud';

/** Картинки частиц. */
export interface EffectSheets {
  readonly sparkle: SpriteSheet;
  readonly dust: SpriteSheet;
  readonly puff: SpriteSheet;
}

interface Particle {
  readonly sprite: BillboardSprite;
  readonly velocity: THREE.Vector3;
  age: number;
  life: number;
  /** Кадры по порядку за время жизни. */
  frames: readonly number[];
  gravity: number;
  active: boolean;
}

const SPARKLE_FRAMES = [0, 1, 2, 2, 1, 0];
const PUFF_FRAMES = [0, 1, 2];
/** Большой клуб пара, когда печь «поддаёт». */
const STEAM_BURST: PuffLook = { color: '#ffffff', opacity: 0.7, size: [0.7, 2.2] };

/** Пул одинаковых частиц: спрайты создаются один раз и переиспользуются. */
class ParticlePool {
  private readonly particles: Particle[] = [];

  constructor(scene: THREE.Scene, sheet: SpriteSheet, size: number) {
    for (let i = 0; i < size; i++) {
      const sprite = new BillboardSprite(sheet);
      sprite.object.visible = false;
      scene.add(sprite.object);
      this.particles.push({ sprite, velocity: new THREE.Vector3(), age: 0, life: 1, frames: PUFF_FRAMES, gravity: 0, active: false });
    }
  }

  /** Запускает частицу; если свободных нет — берёт самую старую. */
  emit(at: THREE.Vector3, velocity: THREE.Vector3, life: number, frames: readonly number[], gravity = 0): void {
    const particle = this.particles.find((p) => !p.active) ?? this.particles.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    particle.sprite.object.position.copy(at);
    particle.velocity.copy(velocity);
    particle.age = 0;
    particle.life = life;
    particle.frames = frames;
    particle.gravity = gravity;
    particle.active = true;
    particle.sprite.object.visible = true;
    particle.sprite.setFrame(frames[0]);
  }

  update(dt: number): void {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        p.sprite.object.visible = false;
        continue;
      }
      p.velocity.y -= p.gravity * dt;
      p.sprite.object.position.addScaledVector(p.velocity, dt);
      const frame = p.frames[Math.min(p.frames.length - 1, Math.floor((p.age / p.life) * p.frames.length))];
      p.sprite.setFrame(frame);
    }
  }
}

/**
 * «Сочность»: блёстки, пыль из-под ног, клубы пара, монеты, летящие в кошелёк, и тряска камеры.
 * Только картинка — на правила игры не влияет.
 */
export class Effects {
  private readonly sparklePool: ParticlePool;
  private readonly dustPool: ParticlePool;
  private readonly steamPool: PuffPool;
  private readonly labels: LabelLayer;
  private readonly hud: Hud;
  private readonly camera: FollowCamera;
  private readonly scratch = new THREE.Vector3();

  constructor(scene: THREE.Scene, sheets: EffectSheets, labels: LabelLayer, hud: Hud, camera: FollowCamera) {
    this.sparklePool = new ParticlePool(scene, sheets.sparkle, 32);
    this.dustPool = new ParticlePool(scene, sheets.dust, 14);
    this.steamPool = new PuffPool(scene, sheets.puff, 16);
    this.labels = labels;
    this.hud = hud;
    this.camera = camera;
  }

  update(dt: number): void {
    this.sparklePool.update(dt);
    this.dustPool.update(dt);
    this.steamPool.update(dt);
  }

  /** Тряска камеры: 0.1 — лёгкий шлепок, 0.3 — сильный удар. */
  shake(strength: number): void {
    this.camera.shake(strength);
  }

  /** Россыпь блёсток вокруг точки (редкая покупка, удачная кража, «Голда»). */
  sparkles(at: THREE.Vector3, big = false): void {
    const count = big ? 16 : 8;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = (big ? 2.6 : 1.8) * (0.6 + Math.random() * 0.6);
      this.scratch.set(Math.cos(angle) * speed, 2.2 + Math.random() * 2, Math.sin(angle) * speed * 0.6);
      this.sparklePool.emit(at.clone().setY(at.y + 0.9), this.scratch, 0.7 + Math.random() * 0.3, SPARKLE_FRAMES, 5);
    }
  }

  /** Облачко пыли из-под ног. */
  dust(at: THREE.Vector3): void {
    this.scratch.set((Math.random() - 0.5) * 0.4, 0.35, (Math.random() - 0.5) * 0.3);
    this.dustPool.emit(at.clone().setY(0.02), this.scratch, 0.45, PUFF_FRAMES);
  }

  /** Большой клуб пара (печь «поддаёт»); driftX — куда его несёт (от печи к полку). */
  steam(at: THREE.Vector3, spread = 3, driftX = 0): void {
    for (let i = 0; i < 12; i++) {
      this.scratch.set(driftX + (Math.random() - 0.5) * spread, 0.8 + Math.random() * 0.9, (Math.random() - 0.3) * 0.8);
      const start = at.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.4, 0));
      this.steamPool.emit(start, this.scratch, 1.8 + Math.random() * 0.9, STEAM_BURST);
    }
  }

  /** Монеты вылетают из точки мира и летят в кошелёк. */
  coins(at: THREE.Vector3, amount: number): void {
    const screen = this.labels.toScreen(at);
    if (!screen) return;
    const count = Math.min(7, 2 + Math.floor(Math.log10(Math.max(1, amount))));
    this.hud.flyCoins(screen.x, screen.y, count);
  }
}
