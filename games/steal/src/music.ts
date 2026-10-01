// Фоновая мелодия «Банная полька»: ля минор, бодрый народный ритм «ум-па».
// Своя, написана кодом, крутится по кругу (16 тактов, около 34 секунд).
import type { SongDef } from '@engine/chiptune';

type Chord = 'Am' | 'Dm' | 'G' | 'C' | 'F' | 'E';

/** Аккорды по тактам — дважды по восемь. */
const CHORDS: readonly Chord[] = ['Am', 'Dm', 'G', 'C', 'F', 'Dm', 'E', 'Am'];

/** Бас: «ум» на первую и третью долю — основной тон и квинта. */
const BASS: Record<Chord, string> = {
  Am: 'A2:2 r:2 E2:2 r:2',
  Dm: 'D3:2 r:2 A2:2 r:2',
  G: 'G2:2 r:2 D3:2 r:2',
  C: 'C3:2 r:2 G2:2 r:2',
  F: 'F2:2 r:2 C3:2 r:2',
  E: 'E2:2 r:2 B2:2 r:2',
};

/** «Па» на вторую и четвёртую долю — короткий аккорд. */
const STAB: Record<Chord, string> = {
  Am: 'A3+C4+E4',
  Dm: 'A3+D4+F4',
  G: 'G3+B3+D4',
  C: 'G3+C4+E4',
  F: 'A3+C4+F4',
  E: 'G#3+B3+E4',
};

const LEAD = `
  A4:2 C5 E5 A5:2 G5 E5 | F5:2 E5 D5 F5:2 A5:2 | G5:2 F5 D5 B4:2 D5:2 | E5:2 D5 C5 E5:2 G5:2 |
  A5:2 G5 F5 C5:2 F5:2  | D5:2 E5 F5 A5:2 F5 D5 | E5:2 D5 C5 B4:2 G#4:2 | A4:4 r:2 E5 G#5 |
  A5:2 E5:2 C5:2 E5:2   | D5:2 F5:2 A5:3 G5    | G5:2 D5:2 B4:2 D5 F5  | E5:4 C5:2 E5:2 |
  F5:2 A5:2 C6:2 A5:2   | A5:2 F5:2 D5:2 F5:2  | E5:2 G#5:2 B5:2 G#5 E5 | A5:2 E5:2 C5 B4 A4 G#4
`;

const bars = (bar: (chord: Chord) => string) => [...CHORDS, ...CHORDS].map(bar).join(' | ');

/**
 * Наигрыш медведя на балалайке: начало «Банной польки» бодрее и «щипком» —
 * пасхалка на лесной поляне. Около 8 секунд.
 */
export const BEAR_TUNE: SongDef = {
  bpm: 132,
  stepsPerBeat: 2,
  tracks: [
    {
      wave: 'pulse',
      duty: 0.25,
      volume: 0.2,
      decay: 9,
      notes: 'A4 A4 C5 E5 A5 A5 G5 E5 | F5 F5 E5 D5 F5 F5 A5 A5 | G5 G5 F5 D5 B4 B4 D5 D5 | E5 E5 D5 C5 E5 E5 G#5 G#5 | A5 E5 C5 E5 A5:4',
    },
    { wave: 'triangle', volume: 0.28, decay: 3, notes: 'A2:2 E3:2 A2:2 E3:2 | D3:2 A2:2 D3:2 A2:2 | G2:2 D3:2 G2:2 D3:2 | E2:2 B2:2 E2:2 B2:2 | A2:2 E3:2 A2:4' },
  ],
};

/**
 * Голоса мягкие (v0.6): мелодия — «флейта» с плавной атакой и тающим хвостом, аккорды без щелчка,
 * бочка и шорох тише, поверх — лёгкое эхо на восьмую с точкой. Квадратных «пищащих» голосов нет.
 */
export const BANYA_POLKA: SongDef = {
  bpm: 112,
  stepsPerBeat: 2,
  echo: { delay: (60 / 112) * 0.75, feedback: 0.3, mix: 0.25 },
  tracks: [
    { wave: 'sine', volume: 0.22, attack: 0.05, release: 0.22, decay: 0.8, vibrato: 0.005, notes: LEAD },
    { wave: 'triangle', volume: 0.28, attack: 0.01, release: 0.12, decay: 2.5, notes: bars((chord) => BASS[chord]) },
    { wave: 'sine', volume: 0.06, attack: 0.02, release: 0.16, decay: 8, notes: bars((chord) => `r:2 ${STAB[chord]} r:3 ${STAB[chord]} r`) },
    { wave: 'kick', volume: 0.22, decay: 16, notes: bars(() => 'x r:3 x r:3') },
    { wave: 'noise', volume: 0.02, attack: 0.003, decay: 45, notes: bars(() => 'r:2 x r:3 x r') },
  ],
};
