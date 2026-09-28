// Направления относительно камеры. Поворот камеры (yaw) — угол вокруг вертикали:
// при yaw = 0 камера стоит «на юге» (+Z) и смотрит на «север» (−Z).

import type { PointXZ } from './math';

/**
 * Ряды в листе спрайта с направлениями — порядок как в RPG Maker:
 * лицом к камере, влево, вправо, спиной к камере.
 */
export const Facing = { Front: 0, Left: 1, Right: 2, Back: 3 } as const;
export type Facing = (typeof Facing)[keyof typeof Facing];

/** Насколько «диагональным» должно стать направление, чтобы сменить ряд спрайта. */
const FACING_HYSTERESIS = 0.15;

/**
 * Переводит ввод игрока (x — вправо, y — вперёд, от камеры) в направление
 * на земле с учётом поворота камеры.
 */
export function cameraRelative(inputX: number, inputY: number, cameraYaw: number): PointXZ {
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  // «вперёд» = (−sin, −cos), «вправо» = (cos, −sin)
  return { x: inputX * cos - inputY * sin, z: -inputX * sin - inputY * cos };
}

/**
 * Какой ряд спрайта показать, если персонаж смотрит в направлении (dirX, dirZ).
 * previous — ряд с прошлого кадра: на диагоналях он сохраняется, чтобы спрайт не мигал.
 */
export function facingFromCamera(dirX: number, dirZ: number, cameraYaw: number, previous?: Facing): Facing {
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  const toCamera = dirX * sin + dirZ * cos;
  const toRight = dirX * cos - dirZ * sin;
  const vertical: Facing = toCamera >= 0 ? Facing.Front : Facing.Back;
  const horizontal: Facing = toRight > 0 ? Facing.Right : Facing.Left;
  const difference = Math.abs(toCamera) - Math.abs(toRight);
  if (Math.abs(difference) < FACING_HYSTERESIS && (previous === vertical || previous === horizontal)) {
    return previous;
  }
  return difference >= 0 ? vertical : horizontal;
}
