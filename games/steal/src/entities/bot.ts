import * as THREE from 'three';
import { Animator, type AnimationClip } from '@engine/animation';
import { Facing, facingFromCamera } from '@engine/direction';
import type { Label } from '@engine/labels';
import type { PointXZ } from '@engine/math';
import type { SpriteSheet } from '@engine/sprite';
import { Actor, moveWithCollisions, type Obstacles } from './actor';
import { SwingEffect } from './swing';

const IDLE: AnimationClip = { frames: [0], fps: 1 };
const WALK: AnimationClip = { frames: [0, 1, 2, 3], fps: 10 };
const BOT_RADIUS = 0.35;
/** Ближе этого к цели бот не подходит. */
const STOP_DISTANCE = 0.75;

/**
 * idle — гуляет по своей бане; sleeping — спит (не замечает краж);
 * notice — заметил игрока у себя в бане; guard — идёт выгонять его веником;
 * alert — заметил кражу; chase — гонится за игроком с добычей;
 * swing — замахнулся веником (удар через мгновение); returning — идёт домой;
 * raidGo — идёт к бане игрока; raidWait — ждёт у закрытой щеколды; raidEnter — заходит за персонажем;
 * raidEscape — убегает с добычей; stunned — получил веником, стоит оглушённый.
 */
export type BotState =
  | 'idle'
  | 'sleeping'
  | 'notice'
  | 'guard'
  | 'alert'
  | 'chase'
  | 'swing'
  | 'returning'
  | 'raidGo'
  | 'raidWait'
  | 'raidEnter'
  | 'raidEscape'
  | 'stunned';

/** Сосед-бот: только тело, ходьба и веник. Решения принимает Neighborhood. */
export class Bot extends Actor {
  state: BotState = 'idle';
  /** Сколько секунд прошло в текущем состоянии. */
  stateTime = 0;
  /** Сколько секунд осталось до конца текущего состояния (для сна, бодрствования и т. п.). */
  timer = 0;
  readonly label: Label;
  private readonly animator = new Animator(IDLE);
  private readonly path: THREE.Vector3[] = [];
  private readonly swingEffect: SwingEffect;
  private facing: Facing = Facing.Front;
  private moved = false;
  private status = '';

  constructor(sheet: SpriteSheet, label: Label, broomSheet: SpriteSheet) {
    super(sheet, 0.8);
    this.label = label;
    this.sprite.enableSilhouette();
    this.swingEffect = new SwingEffect(broomSheet, this.root);
  }

  setState(state: BotState, timer = 0): void {
    this.state = state;
    this.stateTime = 0;
    this.timer = timer;
    this.path.length = 0;
  }

  setPath(points: readonly THREE.Vector3[]): void {
    this.path.length = 0;
    this.path.push(...points.map((p) => p.clone()));
  }

  get pathDone(): boolean {
    return this.path.length === 0;
  }

  /** Идёт по точкам маршрута. Возвращает true, когда дошёл до конца. */
  walkPath(dt: number, speed: number): boolean {
    let step = speed * dt;
    while (step > 0 && this.path.length > 0) {
      const target = this.path[0];
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance <= step) {
        this.position.x = target.x;
        this.position.z = target.z;
        this.path.shift();
        step -= distance;
      } else {
        this.face(dx, dz);
        this.position.x += (dx / distance) * step;
        this.position.z += (dz / distance) * step;
        step = 0;
      }
      this.moved = true;
    }
    return this.path.length === 0;
  }

  /**
   * Бежит прямо к цели, скользя вдоль стен. Останавливается за stopDistance до неё:
   * к игроку — в шаге (не наступает на него), к точке пути — вплотную.
   */
  runTowards(target: PointXZ, speed: number, dt: number, obstacles: Obstacles, stopDistance = STOP_DISTANCE): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    this.face(dx, dz);
    if (distance <= stopDistance) return;
    const step = Math.min(distance - stopDistance, speed * dt);
    const p = moveWithCollisions(this.position.x, this.position.z, (dx / distance) * step, (dz / distance) * step, BOT_RADIUS, obstacles);
    this.position.x = p.x;
    this.position.z = p.z;
    this.moved = true;
  }

  /** Бьёт веником в сторону цели. */
  swingAt(target: PointXZ): void {
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    this.face(dx, dz);
    this.swingEffect.play(dx, dz, dx < 0);
  }

  /** Подпись над головой: «💤», «❗», «😤» и т. п. */
  setStatus(text: string): void {
    if (text === this.status) return;
    this.status = text;
    this.label.element.textContent = text;
    this.label.visible = text !== '';
  }

  /** Анимация по итогам кадра: шёл — шагает, стоял — стоит; отлёт от удара. */
  animate(dt: number, obstacles: Obstacles): void {
    this.updateKnock(dt, BOT_RADIUS, obstacles);
    this.stateTime += dt;
    this.animator.play(this.moved ? WALK : IDLE);
    this.animator.update(dt);
    this.sprite.setFrame(this.animator.frame, this.facing);
    // замах — присел перед ударом, оглушён — шатается
    const squash = this.state === 'swing' ? 0.12 : this.state === 'stunned' ? Math.sin(this.stateTime * 18) * 0.08 : 0;
    this.sprite.setSquash(squash);
    this.swingEffect.update(dt);
    this.label.anchor.set(this.position.x, 1.7, this.position.z);
    this.moved = false;
  }

  private face(dx: number, dz: number): void {
    const length = Math.hypot(dx, dz);
    if (length > 1e-4) this.facing = facingFromCamera(dx / length, dz / length, 0, this.facing);
  }
}
