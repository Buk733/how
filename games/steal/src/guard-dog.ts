import * as THREE from 'three';
import { distanceXZ, type PointXZ } from '@engine/math';
import type { Label } from '@engine/labels';
import type { SpriteSheet } from '@engine/sprite';
import { DOG } from './config';
import type { GameContext } from './context';
import type { Obstacles } from './entities/actor';
import { SpeechBubble } from './entities/bubble';
import { Dog, DogFrame } from './entities/dog';

/**
 * away — собаки ещё нет (сосед не дорос); asleep — спит у будки; sit — сидит и сторожит;
 * bark — заметила вора и лает; chase — бежит кусать (не дальше цепи);
 * rest — укусила и отходит к будке; scared — получила веником и прячется в будке.
 */
type DogState = 'away' | 'asleep' | 'sit' | 'bark' | 'chase' | 'rest' | 'scared';

/** Что случилось за кадр: собака подняла шум (будит хозяина) или укусила игрока. */
export type DogEvent = 'bark' | 'bite' | null;

const BARK_TIME = 0.6;
const BITE_DISTANCE = 0.75;
const REST_SPEED = 3;
const SCARED_SPEED = 8;

/** Собака соседа на цепи у будки: лает на воров, будит хозяина и кусает. */
export class GuardDog {
  readonly name: string;
  readonly body: Dog;
  private readonly ctx: GameContext;
  private readonly obstacles: Obstacles;
  /** Где собака сидит — перед будкой; цепь меряется отсюда. */
  private readonly post: THREE.Vector3;
  private readonly status: Label;
  private readonly bubble: SpeechBubble;
  private state: DogState = 'away';
  private timer = 0;
  private barkTimer = 0;

  constructor(ctx: GameContext, sheet: SpriteSheet, name: string, post: THREE.Vector3, obstacles: Obstacles) {
    this.ctx = ctx;
    this.name = name;
    this.post = post.clone();
    this.obstacles = obstacles;
    this.body = new Dog(sheet);
    this.body.position.copy(post);
    this.body.root.visible = false;
    ctx.scene.add(this.body.root);
    this.status = ctx.labels.create('bot-status dog-status');
    this.status.visible = false;
    this.bubble = new SpeechBubble(ctx.labels.create('say-bubble dog-say'));
  }

  get present(): boolean {
    return this.state !== 'away';
  }

  /** Лает или бежит кусать — её стоит шлёпнуть веником. */
  get hostile(): boolean {
    return this.state === 'bark' || this.state === 'chase';
  }

  get position(): THREE.Vector3 {
    return this.body.position;
  }

  /** Собака появляется у соседа, когда он дорос до неё (RIVALS.dogLevel). */
  setPresent(present: boolean): void {
    if (present === this.present) return;
    if (!present) {
      this.state = 'away';
      this.body.root.visible = false;
      this.status.visible = false;
      this.bubble.hide();
      return;
    }
    this.body.position.copy(this.post);
    this.body.root.visible = true;
    this.setState('sit', this.ctx.rng.range(...DOG.awakeTime));
  }

  /** Уснуть надолго (обучение: первая кража должна получиться). */
  sleep(seconds: number): void {
    if (this.present && this.state !== 'scared') this.setState('asleep', seconds);
  }

  /** Удар веником: скулит и прячется в будке. */
  hit(from: PointXZ): void {
    if (!this.present || this.state === 'scared') return;
    this.body.knock(this.position.x - from.x, this.position.z - from.z, 0.8);
    this.bubble.say('Скуль!', 1.2);
    this.ctx.audio.blip('whimper');
    this.setState('scared', DOG.scared);
  }

  /**
   * alarmed — игрок в бане хозяина или несёт его персонажа.
   * Возвращает 'bark', когда собака подняла шум, и 'bite', когда укусила.
   */
  update(dt: number, alarmed: boolean): DogEvent {
    if (this.state === 'away') return null;
    const { player } = this.ctx;
    const body = this.body;
    let event: DogEvent = null;
    this.timer -= dt;
    switch (this.state) {
      case 'asleep':
        this.setStatus('💤');
        body.show(DogFrame.Sleep);
        if (this.timer <= 0) this.setState('sit', this.ctx.rng.range(...DOG.awakeTime));
        break;
      case 'sit':
        this.setStatus('');
        body.lookAt(player.position);
        body.show(DogFrame.Sit);
        if (alarmed && this.canReach(player.position) && !player.isStunned) {
          this.setState('bark', BARK_TIME);
          this.bubble.say('Гав! Гав!', 1.2);
          this.ctx.audio.blip('bark');
          event = 'bark';
        } else if (this.timer <= 0) {
          this.setState('asleep', this.ctx.rng.range(...DOG.sleepTime));
        }
        break;
      case 'bark':
        body.lookAt(player.position);
        body.show(Math.floor(this.timer * 7) % 2 ? DogFrame.Bark : DogFrame.Sit);
        if (this.timer <= 0) this.setState('chase');
        break;
      case 'chase': {
        this.setStatus('😡');
        if (!alarmed || player.isStunned) {
          this.setState('rest', 0);
          break;
        }
        body.runTowards(this.onLeash(player.position), DOG.speed, dt, this.obstacles, 0.4);
        body.show(DogFrame.RunA);
        this.barkTimer -= dt;
        if (this.barkTimer <= 0) {
          this.barkTimer = 1.4;
          this.bubble.say('Гав!', 0.8);
          this.ctx.audio.blip('bark');
        }
        if (distanceXZ(this.position, player.position) < BITE_DISTANCE) {
          this.bite();
          event = 'bite';
        }
        break;
      }
      case 'rest': {
        this.setStatus('');
        const home = body.runTowards(this.post, REST_SPEED, dt, this.obstacles);
        body.show(home ? DogFrame.Sit : DogFrame.RunA);
        if (this.timer > 0) break;
        if (alarmed && this.canReach(player.position) && !player.isStunned) this.setState('chase');
        else if (home) this.setState('sit', this.ctx.rng.range(...DOG.awakeTime));
        break;
      }
      case 'scared': {
        this.setStatus('');
        const inside = body.runTowards(this.post, SCARED_SPEED, dt, this.obstacles);
        body.show(DogFrame.Scared);
        // добежала до будки — спряталась внутри, пока не пройдёт испуг
        body.root.visible = !inside;
        if (this.timer <= 0) {
          body.root.visible = true;
          this.setState('sit', this.ctx.rng.range(...DOG.awakeTime));
        }
        break;
      }
    }
    body.animate(dt, this.obstacles);
    this.clampToLeash();
    this.status.anchor.set(this.position.x, 1.25, this.position.z);
    this.bubble.update(dt, this.status.anchor.clone().setY(this.status.visible ? 1.9 : 1.3));
    return event;
  }

  private bite(): void {
    const { player } = this.ctx;
    player.stun(DOG.biteStun);
    player.knock(player.position.x - this.position.x, player.position.z - this.position.z, DOG.biteKnock);
    this.ctx.labels.float('Цап!', player.position.clone().setY(2), 'float-hit', 800);
    this.ctx.audio.blip('whack');
    this.ctx.fx.shake(0.25);
    this.setState('rest', DOG.biteRest);
  }

  /** Достанет ли собака до точки, не срываясь с цепи. */
  private canReach(p: PointXZ): boolean {
    return distanceXZ(this.post, p) < DOG.leash + 1.5;
  }

  /** Ближайшая к цели точка в пределах цепи. */
  private onLeash(target: PointXZ): PointXZ {
    const dx = target.x - this.post.x;
    const dz = target.z - this.post.z;
    const distance = Math.hypot(dx, dz);
    if (distance <= DOG.leash) return target;
    return { x: this.post.x + (dx / distance) * DOG.leash, z: this.post.z + (dz / distance) * DOG.leash };
  }

  private clampToLeash(): void {
    const p = this.onLeash(this.position);
    this.position.x = p.x;
    this.position.z = p.z;
  }

  private setState(state: DogState, timer = 0): void {
    this.state = state;
    this.timer = timer;
    this.barkTimer = 0;
  }

  private setStatus(text: string): void {
    if (this.status.element.textContent !== text) this.status.element.textContent = text;
    this.status.visible = text !== '' && this.body.root.visible;
  }
}
