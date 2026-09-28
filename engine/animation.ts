/** Анимация — последовательность кадров из одного ряда листа спрайтов. */
export interface AnimationClip {
  /** Номера кадров (столбцы в листе) в порядке показа. */
  readonly frames: readonly number[];
  /** Кадров в секунду. */
  readonly fps: number;
  /** Повторять по кругу (по умолчанию да). */
  readonly loop?: boolean;
}

/** Проигрывает анимации и сообщает, какой кадр показать сейчас. */
export class Animator {
  private clip: AnimationClip;
  private time: number;

  constructor(clip: AnimationClip, startTime = 0) {
    this.clip = clip;
    this.time = startTime;
  }

  /** Включает анимацию. Если она уже играет — продолжает, не начиная заново. */
  play(clip: AnimationClip): void {
    if (clip === this.clip) return;
    this.clip = clip;
    this.time = 0;
  }

  update(dt: number): void {
    this.time += dt;
  }

  /** Номер кадра (столбец в листе), который нужно показать. */
  get frame(): number {
    const { frames, fps, loop = true } = this.clip;
    const index = Math.floor(this.time * fps);
    return frames[loop ? index % frames.length : Math.min(index, frames.length - 1)];
  }

  /** Неповторяющаяся анимация дошла до последнего кадра. */
  get finished(): boolean {
    const { frames, fps, loop = true } = this.clip;
    return !loop && this.time * fps >= frames.length;
  }
}
