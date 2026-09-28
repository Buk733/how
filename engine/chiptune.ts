// Маленький чиптюн-синтезатор: мелодия записывается текстом и превращается в сэмплы.
// Без Web Audio — поэтому его легко тестировать.

export type Wave = 'pulse' | 'triangle' | 'noise' | 'kick';

export interface TrackDef {
  readonly wave: Wave;
  /**
   * Ноты по шагам: «A4:2 C5 r G#4 A3+C4+E4 x». После двоеточия — длина в шагах (по умолчанию 1),
   * r — пауза, «+» — аккорд, x — удар без высоты (для шума и бочки). «|» — тактовая черта, только для глаз.
   */
  readonly notes: string;
  readonly volume: number;
  /** Скважность для pulse: 0.5 — квадрат, 0.25 и 0.125 — «гнусавее». */
  readonly duty?: number;
  /** Как быстро гаснет нота, 1/с: 0 — держится, 15 — короткий щипок. */
  readonly decay?: number;
  /** Вибрато — доля частоты (0.004 — едва заметно). */
  readonly vibrato?: number;
}

export interface SongDef {
  readonly bpm: number;
  /** Шагов в одной доле: 2 — восьмые. */
  readonly stepsPerBeat: number;
  readonly tracks: readonly TrackDef[];
}

export interface NoteEvent {
  readonly step: number;
  readonly length: number;
  /** MIDI-номера нот (несколько — аккорд, 0 — удар без высоты). */
  readonly pitches: readonly number[];
}

const NOTE_OFFSETS: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ATTACK = 0.004;
const RELEASE = 0.03;

/** «A4» → 69, «C#5» → 73, «Bb3» → 58. */
export function noteToMidi(name: string): number {
  const match = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!match) throw new Error(`Непонятная нота: ${name}`);
  const [, letter, accidental, octave] = match;
  return 12 * (Number(octave) + 1) + NOTE_OFFSETS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
}

/** Разбирает строку нот одной дорожки. */
export function parseNotes(text: string): { events: NoteEvent[]; steps: number } {
  const events: NoteEvent[] = [];
  let step = 0;
  for (const token of text.split(/\s+/)) {
    if (!token || token === '|') continue;
    const [body, lengthText] = token.split(':');
    const length = lengthText === undefined ? 1 : Number(lengthText);
    if (!(length > 0)) throw new Error(`Непонятная длина: ${token}`);
    if (body !== 'r') events.push({ step, length, pitches: body === 'x' ? [0] : body.split('+').map(noteToMidi) });
    step += length;
  }
  return { events, steps: step };
}

/** Длина мелодии в секундах. */
export function songDuration(song: SongDef): number {
  const steps = Math.max(...song.tracks.map((track) => parseNotes(track.notes).steps));
  return (steps * 60) / song.bpm / song.stepsPerBeat;
}

/**
 * Сэмплы всей мелодии (моно, −1…1). Хвосты последних нот переходят в начало,
 * поэтому запись можно крутить по кругу без щелчка на стыке.
 */
export function renderSong(song: SongDef, sampleRate: number): Float32Array {
  const job = renderSongGradually(song, sampleRate);
  for (;;) {
    const result = job.next();
    if (result.done) return result.value;
  }
}

/**
 * То же, что renderSong, но по кусочкам: после каждой ноты можно отдать управление
 * и продолжить в следующем кадре — синтез не подвешивает игру.
 */
export function* renderSongGradually(song: SongDef, sampleRate: number): Generator<void, Float32Array, void> {
  const stepSeconds = 60 / song.bpm / song.stepsPerBeat;
  const out = new Float32Array(Math.round(songDuration(song) * sampleRate));
  const noise = createNoise(12345);
  for (const track of song.tracks) {
    for (const event of parseNotes(track.notes).events) {
      const start = Math.round(event.step * stepSeconds * sampleRate);
      for (const pitch of event.pitches) renderNote(out, start, event.length * stepSeconds, pitch, track, sampleRate, noise);
      yield;
    }
  }
  // мягкое ограничение: громкие аккорды не «хрипят»
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.tanh(out[i]);
    if ((i & 0xffff) === 0xffff) yield;
  }
  return out;
}

function renderNote(
  out: Float32Array,
  start: number,
  duration: number,
  pitch: number,
  track: TrackDef,
  sampleRate: number,
  noise: () => number,
): void {
  const baseStep = (440 * 2 ** ((pitch - 69) / 12)) / sampleRate;
  const duty = track.duty ?? 0.5;
  const vibrato = track.vibrato ?? 0;
  const attack = Math.max(1, Math.round(ATTACK * sampleRate));
  const hold = Math.round(duration * sampleRate);
  const release = Math.round(RELEASE * sampleRate);
  // затухания считаются умножением на каждом сэмпле — без exp в цикле
  const decayFactor = Math.exp(-(track.decay ?? 0) / sampleRate);
  const sweepFactor = Math.exp(-30 / sampleRate);
  let decayed = 1;
  let sweep = 100;
  let vibratoFactor = 1;
  let phase = 0;
  let index = start % out.length;
  for (let i = 0; i < hold + release; i++) {
    let level = i < attack ? i / attack : (decayed *= decayFactor);
    if (i >= hold) level *= 1 - (i - hold) / release;
    if (level < 1e-4 && i > attack) break;
    let sample = 0;
    let step = baseStep;
    switch (track.wave) {
      case 'pulse':
        sample = pulse(phase, step, duty);
        break;
      case 'triangle':
        sample = 1 - 4 * Math.abs(phase - 0.5);
        break;
      case 'noise':
        sample = noise();
        break;
      case 'kick':
        // бочка: синус, который быстро падает от 150 до 50 Гц
        step = (50 + sweep) / sampleRate;
        sweep *= sweepFactor;
        sample = Math.sin(2 * Math.PI * phase);
        break;
    }
    out[index] += sample * level * track.volume;
    if (++index === out.length) index = 0;
    if (vibrato > 0) {
      if ((i & 63) === 0) {
        const time = i / sampleRate;
        vibratoFactor = 1 + vibrato * Math.sin(2 * Math.PI * 5.5 * time) * Math.min(1, time / 0.25);
      }
      step *= vibratoFactor;
    }
    phase += step;
    if (phase >= 1) phase -= 1;
  }
}

/** Прямоугольная волна со сглаженными скачками (PolyBLEP) и без постоянной составляющей. */
function pulse(phase: number, step: number, duty: number): number {
  const naive = phase < duty ? 1 : -1;
  return naive + polyBlep(phase, step) - polyBlep((phase - duty + 1) % 1, step) - (2 * duty - 1);
}

function polyBlep(t: number, step: number): number {
  if (t < step) {
    const x = t / step;
    return x + x - x * x - 1;
  }
  if (t > 1 - step) {
    const x = (t - 1) / step;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Повторяемый шум: одна и та же мелодия звучит одинаково. */
function createNoise(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 31 - 1;
  };
}
