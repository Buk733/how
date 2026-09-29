import * as THREE from 'three';
import { clamp, damp } from './math';

export interface FollowCameraOptions {
  /** Угол обзора по вертикали, градусы. */
  readonly fov: number;
  /** Наклон камеры вниз от горизонта, градусы. */
  readonly pitchDeg: number;
  readonly distance: number;
  readonly minDistance: number;
  readonly maxDistance: number;
  /** На сколько градусов поворачивает один шаг rotate(). */
  readonly yawStepDeg: number;
  readonly followSharpness: number;
  readonly rotateSharpness: number;
  readonly zoomSharpness: number;
  /** Куда смотреть над целью: центр кадра на уровне груди, а не ног. */
  readonly lookHeight: number;
  /** Угол обзора и отдаление для вертикального экрана (по умолчанию — как для горизонтального). */
  readonly portraitFov?: number;
  readonly portraitDistanceScale?: number;
  /** Насколько смотреть «вперёд» от цели по земле: цель оказывается ниже центра кадра. */
  readonly lead?: number;
}

/** Камера, которая плавно следует за целью, поворачивается шагами и приближается. */
export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private readonly options: FollowCameraOptions;
  private readonly focus = new THREE.Vector3();
  private yaw = 0;
  private targetYaw = 0;
  private distance: number;
  private targetDistance: number;
  private distanceScale = 1;
  /** Сила тряски (в единицах мира) — гаснет сама. */
  private shakeStrength = 0;

  constructor(options: FollowCameraOptions) {
    this.options = options;
    this.camera = new THREE.PerspectiveCamera(options.fov, 1, 0.5, 200);
    this.distance = options.distance;
    this.targetDistance = options.distance;
  }

  /** Текущий поворот камеры вокруг вертикали, радианы. 0 — камера «на юге» (+Z) и смотрит на север (−Z). */
  get yawRadians(): number {
    return this.yaw;
  }

  rotate(steps: number): void {
    this.targetYaw += THREE.MathUtils.degToRad(this.options.yawStepDeg) * steps;
  }

  /** amount > 0 — отдалить, < 0 — приблизить. */
  zoom(amount: number): void {
    this.targetDistance = clamp(this.targetDistance * Math.exp(amount), this.options.minDistance, this.options.maxDistance);
  }

  setAspect(aspect: number): void {
    const portrait = aspect < 1;
    this.camera.aspect = aspect;
    this.camera.fov = portrait ? (this.options.portraitFov ?? this.options.fov) : this.options.fov;
    this.distanceScale = portrait ? (this.options.portraitDistanceScale ?? 1) : 1;
    this.camera.updateProjectionMatrix();
    this.apply();
  }

  /** Встряхнуть камеру (удар, укус): strength — насколько сильно, в единицах мира. */
  shake(strength: number): void {
    this.shakeStrength = Math.max(this.shakeStrength, strength);
  }

  /** Мгновенно переносит камеру к цели, без плавного догоняния. */
  jumpTo(target: THREE.Vector3): void {
    this.focus.copy(target);
    this.yaw = this.targetYaw;
    this.distance = this.targetDistance;
    this.apply();
  }

  update(dt: number, target: THREE.Vector3): void {
    const o = this.options;
    this.yaw = damp(this.yaw, this.targetYaw, o.rotateSharpness, dt);
    this.distance = damp(this.distance, this.targetDistance, o.zoomSharpness, dt);
    this.focus.set(
      damp(this.focus.x, target.x, o.followSharpness, dt),
      damp(this.focus.y, target.y, o.followSharpness, dt),
      damp(this.focus.z, target.z, o.followSharpness, dt),
    );
    this.shakeStrength = this.shakeStrength < 0.005 ? 0 : damp(this.shakeStrength, 0, 9, dt);
    this.apply();
  }

  private apply(): void {
    const pitch = THREE.MathUtils.degToRad(this.options.pitchDeg);
    const distance = this.distance * this.distanceScale;
    const horizontal = Math.cos(pitch) * distance;
    this.camera.position.set(
      this.focus.x + Math.sin(this.yaw) * horizontal,
      this.focus.y + Math.sin(pitch) * distance,
      this.focus.z + Math.cos(this.yaw) * horizontal,
    );
    const lead = this.options.lead ?? 0;
    this.camera.position.x -= Math.sin(this.yaw) * lead;
    this.camera.position.z -= Math.cos(this.yaw) * lead;
    this.camera.lookAt(
      this.focus.x - Math.sin(this.yaw) * lead,
      this.focus.y + this.options.lookHeight,
      this.focus.z - Math.cos(this.yaw) * lead,
    );
    if (this.shakeStrength > 0) {
      // сдвиг без поворота: картинка дрожит, а направление взгляда то же
      this.camera.position.x += (Math.random() * 2 - 1) * this.shakeStrength;
      this.camera.position.y += (Math.random() * 2 - 1) * this.shakeStrength * 0.6;
    }
  }
}
