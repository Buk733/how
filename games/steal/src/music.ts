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

export const BANYA_POLKA: SongDef = {
  bpm: 112,
  stepsPerBeat: 2,
  tracks: [
    { wave: 'pulse', duty: 0.25, volume: 0.16, decay: 1.2, vibrato: 0.004, notes: LEAD },
    { wave: 'triangle', volume: 0.3, decay: 2.5, notes: bars((chord) => BASS[chord]) },
    { wave: 'pulse', duty: 0.125, volume: 0.05, decay: 14, notes: bars((chord) => `r:2 ${STAB[chord]} r:3 ${STAB[chord]} r`) },
    { wave: 'kick', volume: 0.3, decay: 16, notes: bars(() => 'x r:3 x r:3') },
    { wave: 'noise', volume: 0.035, decay: 45, notes: bars(() => 'r:2 x r:3 x r') },
  ],
};
