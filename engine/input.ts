import { VirtualJoystick } from './joystick';

/** Коды клавиш (KeyboardEvent.code) — работают при любой раскладке, в том числе русской. */
const MOVE_KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
} as const;
const ACTION_KEYS: readonly string[] = ['KeyE', 'Space', 'Enter'];
const PREVENT_DEFAULT: ReadonlySet<string> = new Set([...Object.values(MOVE_KEYS).flat(), 'Space']);

export interface MoveVector {
  /** Вправо (+) / влево (−). */
  readonly x: number;
  /** Вперёд, от камеры (+) / назад (−). */
  readonly y: number;
}

/** Превращает набор зажатых клавиш в вектор движения длиной не больше 1. */
export function keysToVector(pressed: ReadonlySet<string>): MoveVector {
  const has = (codes: readonly string[]) => codes.some((code) => pressed.has(code));
  const x = (has(MOVE_KEYS.right) ? 1 : 0) - (has(MOVE_KEYS.left) ? 1 : 0);
  const y = (has(MOVE_KEYS.up) ? 1 : 0) - (has(MOVE_KEYS.down) ? 1 : 0);
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/** Клавиатура, колесо мыши и экранный джойстик в одном месте. */
export class Input {
  private readonly element: HTMLElement;
  private readonly pressed = new Set<string>();
  private readonly joystick: VirtualJoystick;
  private readonly gestureListeners: (() => void)[] = [];
  private actionQueued = false;
  private zoomDelta = 0;

  constructor(element: HTMLElement) {
    this.element = element;
    this.joystick = new VirtualJoystick(element);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    element.addEventListener('pointerdown', this.onGesture);
  }

  /** Направление движения с клавиатуры или джойстика. */
  get move(): MoveVector {
    return this.joystick.active ? this.joystick.vector : keysToVector(this.pressed);
  }

  /** Нажатие экранной кнопки действия (купить, открыть и т. п.). */
  queueAction(): void {
    this.actionQueued = true;
  }

  /** Было ли действие с прошлого кадра. Сбрасывает флаг. */
  consumeAction(): boolean {
    const queued = this.actionQueued;
    this.actionQueued = false;
    return queued;
  }

  /** Накопленная прокрутка колеса: > 0 — отдалить. */
  consumeZoom(): number {
    const delta = this.zoomDelta;
    this.zoomDelta = 0;
    return delta;
  }

  /** Первое касание или нажатие клавиши — после него браузер разрешает звук. */
  onFirstGesture(listener: () => void): void {
    this.gestureListeners.push(listener);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('pointerdown', this.onGesture);
    this.joystick.dispose();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (PREVENT_DEFAULT.has(event.code)) event.preventDefault();
    this.pressed.add(event.code);
    if (ACTION_KEYS.includes(event.code) && !event.repeat) this.actionQueued = true;
    this.onGesture();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.pressed.clear();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.zoomDelta += Math.sign(event.deltaY) * 0.12;
  };

  private readonly onGesture = (): void => {
    for (const listener of this.gestureListeners.splice(0)) listener();
  };
}
