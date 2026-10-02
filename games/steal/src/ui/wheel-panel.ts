import { formatChance, t } from '../i18n';
import { button, element, formatWait } from './dom';
import { Modal } from './modal';

export interface WheelSectorView {
  readonly icon: string;
  readonly label: string;
  readonly color: string;
  /** Шанс сектора; размер сектора на колесе ему пропорционален. */
  readonly chance: number;
}

export interface WheelView {
  readonly free: boolean;
  /** Через сколько мс бесплатный спин. */
  readonly freeIn: number;
  /** Сколько спинов за рекламу осталось сегодня. */
  readonly adLeft: number;
}

export interface WheelPanelCallbacks {
  onSpin(kind: 'free' | 'ad'): void;
  onClose(): void;
  /** Стрелка перешла на следующий сектор — щелчок. */
  onTick(): void;
  /** Колесо остановилось. */
  onStop(): void;
}

const SIZE = 280;
const SPIN_MS = 4200;
const TURN = Math.PI * 2;

/** Колесо удачи: сектора размером по шансам, бесплатный спин по таймеру и спины за рекламу. */
export class WheelPanel {
  readonly modal: Modal;
  private readonly callbacks: WheelPanelCallbacks;
  private readonly sectors: readonly WheelSectorView[];
  /** Границы секторов по часовой стрелке от верха, в радианах. */
  private readonly edges: number[] = [];
  private readonly canvas: HTMLCanvasElement;
  private readonly freeButton: HTMLButtonElement;
  private readonly adButton: HTMLButtonElement;
  private readonly result: HTMLDivElement;
  private angle = 0;
  private frame = 0;

  constructor(container: HTMLElement, sectors: readonly WheelSectorView[], callbacks: WheelPanelCallbacks) {
    this.callbacks = callbacks;
    this.sectors = sectors;
    let edge = 0;
    for (const sector of sectors) {
      this.edges.push(edge);
      edge += sector.chance * TURN;
    }
    this.edges.push(TURN);

    this.modal = new Modal(container, t.wheel.title, () => callbacks.onClose(), 'wheel-panel');
    const stage = element('div', 'wheel-stage');
    this.canvas = element('canvas', 'wheel-canvas');
    stage.append(this.canvas, element('div', 'wheel-pointer', '▼'));
    this.result = element('div', 'wheel-result', t.wheel.idle);
    this.freeButton = button('buy-button free', '', () => callbacks.onSpin('free'));
    this.adButton = button('ad-button', '', () => callbacks.onSpin('ad'));
    const buttons = element('div', 'wheel-buttons');
    buttons.append(this.freeButton, this.adButton);

    const odds = element('div', 'wheel-odds');
    for (const sector of sectors) {
      const row = element('div', 'wheel-odds-row');
      const swatch = element('span', 'wheel-swatch');
      swatch.style.background = sector.color;
      row.append(swatch, element('span', 'wheel-odds-label', `${sector.icon} ${sector.label}`), element('span', 'wheel-odds-chance', formatChance(sector.chance)));
      odds.append(row);
    }
    this.modal.body.append(stage, this.result, buttons, element('div', 'modal-subtitle', t.wheel.odds), odds);
    this.draw();
  }

  get spinning(): boolean {
    return this.frame !== 0;
  }

  render(view: WheelView): void {
    const freeText = view.free ? t.wheel.free : t.wheel.freeIn(formatWait(view.freeIn));
    if (this.freeButton.textContent !== freeText) this.freeButton.textContent = freeText;
    this.freeButton.classList.toggle('disabled', !view.free || this.spinning);
    const adText = view.adLeft > 0 ? t.wheel.ad(view.adLeft) : t.wheel.adTomorrow;
    if (this.adButton.textContent !== adText) this.adButton.textContent = adText;
    this.adButton.classList.toggle('disabled', view.adLeft === 0 || this.spinning);
  }

  /** Крутит колесо до сектора index и показывает text. */
  spinTo(index: number, text: string): void {
    this.stop();
    this.result.textContent = t.wheel.spinning;
    const from = this.edges[index];
    const width = this.edges[index + 1] - from;
    // точка сектора, которая окажется под стрелкой, — не у самой границы
    const target = from + width * (0.15 + Math.random() * 0.7);
    const start = this.angle;
    // поворот колеса по часовой: под стрелкой сверху оказывается точка −angle
    const end = start + 5 * TURN + ((((-target - start) % TURN) + TURN) % TURN);
    const began = performance.now();
    let lastSector = this.sectorAt(start);
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / SPIN_MS);
      this.angle = start + (end - start) * (1 - (1 - t) ** 3);
      this.canvas.style.transform = `rotate(${this.angle}rad)`;
      const sector = this.sectorAt(this.angle);
      if (sector !== lastSector) {
        lastSector = sector;
        this.callbacks.onTick();
      }
      if (t < 1) {
        this.frame = requestAnimationFrame(step);
        return;
      }
      this.frame = 0;
      this.angle %= TURN;
      this.result.textContent = text;
      this.callbacks.onStop();
    };
    this.frame = requestAnimationFrame(step);
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** Какой сектор под стрелкой при повороте angle. */
  private sectorAt(angle: number): number {
    const under = (((-angle % TURN) + TURN) % TURN);
    for (let i = 0; i < this.sectors.length; i++) if (under < this.edges[i + 1]) return i;
    return this.sectors.length - 1;
  }

  private draw(): void {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = SIZE * ratio;
    this.canvas.height = SIZE * ratio;
    this.canvas.style.width = `${SIZE}px`;
    this.canvas.style.height = `${SIZE}px`;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    const c = SIZE / 2;
    const r = c - 6;
    // 0 рад в canvas — вправо; сверху — −π/2
    const toCanvas = (a: number) => a - Math.PI / 2;
    this.sectors.forEach((sector, i) => {
      const a0 = toCanvas(this.edges[i]);
      const a1 = toCanvas(this.edges[i + 1]);
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = sector.color;
      ctx.fill();
      ctx.strokeStyle = '#1a1c2c';
      ctx.lineWidth = 3;
      ctx.stroke();
      // значок и подпись вдоль радиуса; в узких секторах — только значок.
      // на левой половине подпись переворачивается, чтобы не читалась вверх ногами
      const mid = (a0 + a1) / 2;
      const wide = sector.chance >= 0.1;
      const flip = Math.cos(mid) < 0;
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(flip ? mid + Math.PI : mid);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const along = (distance: number) => (flip ? -distance : distance);
      ctx.font = `${wide ? 22 : 16}px system-ui, sans-serif`;
      ctx.fillText(sector.icon, along(r - 22), 0);
      if (wide) {
        ctx.font = '800 11px "Trebuchet MS", system-ui, sans-serif';
        ctx.fillStyle = '#1a1c2c';
        ctx.fillText(sector.label, along(r - 70), 0);
      }
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(c, c, 18, 0, TURN);
    ctx.fillStyle = '#1a1c2c';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TURN);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#1a1c2c';
    ctx.stroke();
  }
}
