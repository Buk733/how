import type { MoveVector } from './input';

const RADIUS = 56; // радиус хода «шляпки» в CSS-пикселях
const DEAD_ZONE = 0.15;

/**
 * Экранный джойстик для сенсорных экранов: появляется там, где коснулись,
 * и ведёт персонажа, пока палец на экране. Мышь не трогает.
 */
export class VirtualJoystick {
  vector: MoveVector = { x: 0, y: 0 };
  private readonly element: HTMLElement;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;

  constructor(element: HTMLElement) {
    this.element = element;
    this.base = document.createElement('div');
    this.knob = document.createElement('div');
    Object.assign(this.base.style, {
      position: 'absolute',
      width: `${RADIUS * 2}px`,
      height: `${RADIUS * 2}px`,
      margin: `-${RADIUS}px 0 0 -${RADIUS}px`,
      borderRadius: '50%',
      border: '3px solid rgb(244 244 244 / 0.6)',
      background: 'rgb(26 28 44 / 0.25)',
      pointerEvents: 'none',
      display: 'none',
      zIndex: '5',
    });
    Object.assign(this.knob.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: '48px',
      height: '48px',
      margin: '-24px 0 0 -24px',
      borderRadius: '50%',
      background: 'rgb(244 244 244 / 0.8)',
    });
    this.base.append(this.knob);
    element.append(this.base);
    element.addEventListener('pointerdown', this.onDown);
    element.addEventListener('pointermove', this.onMove);
    element.addEventListener('pointerup', this.onUp);
    element.addEventListener('pointercancel', this.onUp);
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onDown);
    this.element.removeEventListener('pointermove', this.onMove);
    this.element.removeEventListener('pointerup', this.onUp);
    this.element.removeEventListener('pointercancel', this.onUp);
    this.base.remove();
  }

  private readonly onDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' || this.pointerId !== null) return;
    this.pointerId = event.pointerId;
    this.originX = event.clientX;
    this.originY = event.clientY;
    const rect = this.element.getBoundingClientRect();
    this.base.style.left = `${event.clientX - rect.left}px`;
    this.base.style.top = `${event.clientY - rect.top}px`;
    this.base.style.display = 'block';
    this.element.setPointerCapture?.(event.pointerId);
    this.onMove(event);
  };

  private readonly onMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    let dx = event.clientX - this.originX;
    let dy = event.clientY - this.originY;
    const length = Math.hypot(dx, dy);
    if (length > RADIUS) {
      dx = (dx / length) * RADIUS;
      dy = (dy / length) * RADIUS;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const strength = Math.min(length, RADIUS) / RADIUS;
    // экран: вверх = вперёд
    this.vector = strength < DEAD_ZONE ? { x: 0, y: 0 } : { x: dx / RADIUS, y: -dy / RADIUS };
  };

  private readonly onUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.vector = { x: 0, y: 0 };
    this.base.style.display = 'none';
    this.knob.style.transform = '';
  };
}
