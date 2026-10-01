export interface PlayOptions {
  /** С какой секунды записи начать. */
  readonly offset?: number;
  /** Сколько секунд играть (по умолчанию — до конца). */
  readonly duration?: number;
  /** Громкость 0…1. */
  readonly volume?: number;
  /** Играть по кругу (фоновая музыка). */
  readonly loop?: boolean;
  /** Плавно появиться за столько секунд, а не начаться резко. */
  readonly fadeIn?: number;
  /** Плавно затихнуть к концу записи за столько секунд (не для loop). */
  readonly fadeOut?: number;
}

export interface LoadOptions {
  /**
   * Выровнять громкость записи: запись подгоняется к этому среднеквадратичному уровню,
   * чтобы тихие и громкие мемы звучали одинаково. Например, 0.1.
   */
  readonly normalizeTo?: number;
}

export type Blip =
  | 'coin'
  | 'buy'
  | 'unlock'
  | 'error'
  | 'alarm'
  | 'caught'
  | 'swing'
  | 'whack'
  | 'gold'
  | 'tick'
  | 'win'
  | 'lose'
  | 'bark'
  | 'whimper'
  | 'bell'
  | 'hiss'
  | 'horn'
  | 'secret'
  | 'plop'
  | 'creak'
  | 'splash'
  | 'stomp';

interface Voice {
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
  /** Множитель выравнивания громкости этой записи. */
  readonly level: number;
}

interface BlipDef {
  /** Форма волны; noise — шум через полосовой фильтр (шипение, всплеск, топот). */
  readonly wave: OscillatorType | 'noise';
  /** Ноты: [частота, задержка в секундах]. Для шума частота — середина полосы фильтра. */
  readonly notes: readonly (readonly [number, number])[];
  /** Длина одной ноты, секунды. */
  readonly length?: number;
  /** Громкость в пике. */
  readonly peak?: number;
  /** Куда уезжает высота к концу ноты: 0.6 — вниз («гав»), 1.5 — вверх («бульк»). */
  readonly slide?: number;
}

/** Синтезированные звуки: какие ноты и какой волной играть. */
const BLIPS: Record<Blip, BlipDef> = {
  coin: { wave: 'square', notes: [[988, 0], [1319, 0.06]] },
  buy: { wave: 'square', notes: [[523, 0], [659, 0.07], [784, 0.14]] },
  unlock: { wave: 'square', notes: [[392, 0], [523, 0.08], [659, 0.16], [1047, 0.24]] },
  error: { wave: 'sawtooth', notes: [[196, 0], [165, 0.1]] },
  alarm: { wave: 'square', notes: [[880, 0], [659, 0.12], [880, 0.24], [659, 0.36]] },
  caught: { wave: 'square', notes: [[330, 0], [247, 0.1], [196, 0.2]] },
  swing: { wave: 'triangle', notes: [[740, 0], [520, 0.03], [330, 0.06]], length: 0.07 },
  whack: { wave: 'sawtooth', notes: [[170, 0], [110, 0.05]], length: 0.1 },
  gold: { wave: 'triangle', notes: [[784, 0], [988, 0.06], [1175, 0.12], [1568, 0.18], [2093, 0.24]], length: 0.2, peak: 0.07 },
  tick: { wave: 'square', notes: [[1800, 0]], length: 0.025, peak: 0.02 },
  win: { wave: 'square', notes: [[523, 0], [659, 0.09], [784, 0.18], [1047, 0.27], [784, 0.36], [1047, 0.45]], length: 0.14 },
  lose: { wave: 'triangle', notes: [[392, 0], [330, 0.14], [262, 0.28], [196, 0.42]], length: 0.2 },
  bark: { wave: 'sawtooth', notes: [[430, 0], [400, 0.17]], length: 0.1, slide: 0.55, peak: 0.045 },
  whimper: { wave: 'triangle', notes: [[1150, 0], [950, 0.13]], length: 0.13, slide: 0.7, peak: 0.04 },
  bell: { wave: 'triangle', notes: [[2093, 0], [2637, 0.012], [2093, 0.2], [2637, 0.212]], length: 0.32, peak: 0.035 },
  hiss: { wave: 'noise', notes: [[5200, 0]], length: 0.75, peak: 0.03 },
  horn: { wave: 'square', notes: [[440, 0], [349, 0.2]], length: 0.17, peak: 0.035 },
  secret: { wave: 'triangle', notes: [[659, 0], [784, 0.08], [988, 0.16], [1319, 0.24], [1568, 0.32], [1976, 0.4]], length: 0.2, peak: 0.05 },
  plop: { wave: 'sine', notes: [[520, 0]], length: 0.14, slide: 2.2, peak: 0.08 },
  creak: { wave: 'sawtooth', notes: [[95, 0], [120, 0.16]], length: 0.2, slide: 1.25, peak: 0.03 },
  splash: { wave: 'noise', notes: [[1300, 0]], length: 0.4, peak: 0.05 },
  stomp: { wave: 'noise', notes: [[180, 0]], length: 0.14, peak: 0.12 },
};

/** Длина общей записи белого шума для шумовых звуков, секунды. */
const NOISE_SECONDS = 1;

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
  private readonly voices = new Map<string, Voice>();
  private noiseBuffer: AudioBuffer | null = null;
  private mutedState = false;
  private paused = false;
  private volume = 1;

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
    const buffer = await this.context.decodeAudioData(await readBytes(url));
    this.setBuffer(id, buffer, options);
  }

  /** Добавляет запись из готовых сэмплов (например, музыку, сгенерированную кодом). */
  addSamples(id: string, samples: Float32Array, sampleRate: number, options: LoadOptions = {}): void {
    if (!this.context) return;
    const buffer = this.context.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    this.setBuffer(id, buffer, options);
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
    this.voices.get(id)?.source.stop();
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop === true;
    const gain = this.context.createGain();
    const level = this.gains.get(id) ?? 1;
    const target = (options.volume ?? 1) * level;
    const offset = options.offset ?? 0;
    if (options.fadeIn) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(target, now + options.fadeIn);
    } else {
      gain.gain.setValueAtTime(target, now);
    }
    const length = options.duration ?? buffer.duration - offset;
    if (options.fadeOut && !source.loop && length > (options.fadeIn ?? 0) + options.fadeOut) {
      gain.gain.setValueAtTime(target, now + length - options.fadeOut);
      gain.gain.linearRampToValueAtTime(0, now + length);
    }
    source.connect(gain).connect(this.master);
    if (source.loop) source.start(0, offset);
    else source.start(0, offset, options.duration);
    source.onended = () => {
      if (this.voices.get(id)?.source === source) this.voices.delete(id);
    };
    this.voices.set(id, { source, gain, level });
  }

  /** Плавно меняет громкость звучащей записи за seconds секунд. */
  fadeTo(id: string, volume: number, seconds: number): void {
    const voice = this.voices.get(id);
    if (!voice || !this.context) return;
    const now = this.context.currentTime;
    const param = voice.gain.gain;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(volume * voice.level, now + seconds);
  }

  /** Останавливает запись; fade — затухание в секундах. Сразу считается не звучащей. */
  stop(id: string, fade = 0): void {
    const voice = this.voices.get(id);
    if (!voice || !this.context) return;
    if (fade > 0) this.fadeTo(id, 0, fade);
    voice.source.stop(this.context.currentTime + fade);
    this.voices.delete(id);
  }

  /** Короткие синтезированные звуки — без файлов. */
  blip(kind: Blip): void {
    const context = this.context;
    if (!context || !this.master || this.paused) return;
    const { wave, notes, length = 0.12, peak = 0.05, slide } = BLIPS[kind];
    const now = context.currentTime;
    for (const [frequency, delay] of notes) {
      const start = now + delay;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.01, length / 3));
      gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
      gain.connect(this.master);
      let source: AudioScheduledSourceNode;
      if (wave === 'noise') {
        const noise = context.createBufferSource();
        noise.buffer = this.noise(context);
        const filter = context.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = frequency;
        filter.Q.value = 0.9;
        noise.connect(filter).connect(gain);
        source = noise;
      } else {
        const osc = context.createOscillator();
        osc.type = wave;
        osc.frequency.setValueAtTime(frequency, start);
        if (slide) osc.frequency.exponentialRampToValueAtTime(frequency * slide, start + length);
        osc.connect(gain);
        source = osc;
      }
      source.start(start);
      source.stop(start + length + 0.01);
    }
  }

  /** Общая запись белого шума (создаётся один раз). */
  private noise(context: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const buffer = context.createBuffer(1, Math.round(context.sampleRate * NOISE_SECONDS), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buffer;
    return buffer;
  }

  setMuted(muted: boolean): void {
    this.mutedState = muted;
    this.applyVolume();
  }

  /** Общая громкость 0…1 — для всех звуков и музыки сразу. */
  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyVolume();
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.mutedState ? 0 : this.volume;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (!this.context) return;
    if (paused) void this.context.suspend();
    else void this.context.resume();
  }

  private setBuffer(id: string, buffer: AudioBuffer, options: LoadOptions): void {
    this.buffers.set(id, buffer);
    if (options.normalizeTo) {
      const gain = options.normalizeTo / Math.max(rms(buffer), 1e-4);
      this.gains.set(id, Math.min(4, Math.max(0.1, gain)));
    }
  }
}

/** Среднеквадратичная громкость записи (по первому каналу). */
function rms(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, data.length));
}

/**
 * Байты записи по URL. Встроенные data:-ссылки (демо-сборка для артефакта) разбираются без fetch:
 * песочница страницы может запрещать fetch к data:.
 */
async function readBytes(url: string): Promise<ArrayBuffer> {
  const header = /^data:[^,]*;base64,/.exec(url);
  if (!header) return (await fetch(url)).arrayBuffer();
  const binary = atob(url.slice(header[0].length));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
