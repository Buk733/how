export interface PlayOptions {
  /** С какой секунды записи начать. */
  readonly offset?: number;
  /** Сколько секунд играть (по умолчанию — до конца). */
  readonly duration?: number;
  /** Громкость 0…1. */
  readonly volume?: number;
}

export interface LoadOptions {
  /**
   * Выровнять громкость записи: запись подгоняется к этому среднеквадратичному уровню,
   * чтобы тихие и громкие мемы звучали одинаково. Например, 0.1.
   */
  readonly normalizeTo?: number;
}

export type Blip = 'coin' | 'buy' | 'unlock' | 'error' | 'alarm' | 'caught';

/**
 * Звук на Web Audio API. Браузер разрешает звук только после первого касания
 * или нажатия клавиши — для этого есть unlock(). setPaused() ставит весь звук на паузу
 * (реклама, свёрнутая вкладка), setMuted() — выключатель для игрока.
 */
export class AudioManager {
  private readonly context: AudioContext | null;
  private readonly master: GainNode | null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly gains = new Map<string, number>();
  private readonly voices = new Map<string, AudioBufferSourceNode>();
  private mutedState = false;
  private paused = false;

  constructor() {
    let context: AudioContext | null = null;
    try {
      context = new AudioContext();
    } catch {
      context = null; // браузер без Web Audio — игра просто будет без звука
    }
    this.context = context;
    this.master = context ? context.createGain() : null;
    if (context && this.master) this.master.connect(context.destination);
  }

  get muted(): boolean {
    return this.mutedState;
  }

  async load(id: string, url: string, options: LoadOptions = {}): Promise<void> {
    if (!this.context) return;
    const response = await fetch(url);
    const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
    this.buffers.set(id, buffer);
    if (options.normalizeTo) {
      const gain = options.normalizeTo / Math.max(rms(buffer), 1e-4);
      this.gains.set(id, Math.min(4, Math.max(0.1, gain)));
    }
  }

  /** Звучит ли сейчас эта запись. */
  isPlaying(id: string): boolean {
    return this.voices.has(id);
  }

  unlock(): void {
    if (this.context && !this.paused && this.context.state === 'suspended') void this.context.resume();
  }

  /** Играет запись. Если та же запись уже звучит — начинает заново, а не накладывает. */
  play(id: string, options: PlayOptions = {}): void {
    const buffer = this.buffers.get(id);
    if (!this.context || !this.master || !buffer || this.paused) return;
    this.voices.get(id)?.stop();
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = (options.volume ?? 1) * (this.gains.get(id) ?? 1);
    source.connect(gain).connect(this.master);
    source.start(0, options.offset ?? 0, options.duration);
    source.onended = () => {
      if (this.voices.get(id) === source) this.voices.delete(id);
    };
    this.voices.set(id, source);
  }

  /** Короткие синтезированные звуки интерфейса — без файлов. */
  blip(kind: Blip): void {
    if (!this.context || !this.master || this.paused) return;
    const notes: Record<Blip, [number, number][]> = {
      coin: [[988, 0], [1319, 0.06]],
      buy: [[523, 0], [659, 0.07], [784, 0.14]],
      unlock: [[392, 0], [523, 0.08], [659, 0.16], [1047, 0.24]],
      error: [[196, 0], [165, 0.1]],
      alarm: [[880, 0], [659, 0.12], [880, 0.24], [659, 0.36]],
      caught: [[330, 0], [247, 0.1], [196, 0.2]],
    };
    const now = this.context.currentTime;
    for (const [frequency, delay] of notes[kind]) {
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      osc.type = kind === 'error' ? 'sawtooth' : 'square';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.05, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.12);
      osc.connect(gain).connect(this.master);
      osc.start(now + delay);
      osc.stop(now + delay + 0.13);
    }
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 1;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.context) return;
    if (paused) void this.context.suspend();
    else void this.context.resume();
  }
}

/** Среднеквадратичная громкость записи (по первому каналу). */
function rms(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, data.length));
}
