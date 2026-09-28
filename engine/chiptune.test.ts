import { describe, expect, it } from 'vitest';
import { noteToMidi, parseNotes, renderSong, songDuration, type SongDef } from './chiptune';

describe('chiptune', () => {
  it('названия нот → MIDI', () => {
    expect(noteToMidi('A4')).toBe(69);
    expect(noteToMidi('C4')).toBe(60);
    expect(noteToMidi('G#4')).toBe(68);
    expect(noteToMidi('Bb3')).toBe(58);
    expect(() => noteToMidi('H2')).toThrow();
  });

  it('разбирает длины, паузы, аккорды и удары', () => {
    const { events, steps } = parseNotes('A4:2 r | C5+E5 x');
    expect(events).toEqual([
      { step: 0, length: 2, pitches: [69] },
      { step: 3, length: 1, pitches: [72, 76] },
      { step: 4, length: 1, pitches: [0] },
    ]);
    expect(steps).toBe(5);
  });

  it('рендерит мелодию нужной длины без выбросов', () => {
    const song: SongDef = {
      bpm: 120,
      stepsPerBeat: 2,
      tracks: [
        { wave: 'pulse', duty: 0.25, volume: 0.3, decay: 1, vibrato: 0.004, notes: 'A4:2 C5 E5 A5:4' },
        { wave: 'triangle', volume: 0.4, notes: 'A2:4 E2:4' },
        { wave: 'kick', volume: 0.4, decay: 16, notes: 'x r:3 x r:3' },
        { wave: 'noise', volume: 0.05, decay: 40, notes: 'r x r x r x r x' },
      ],
    };
    const rate = 8000;
    const samples = renderSong(song, rate);
    expect(songDuration(song)).toBe(2);
    expect(samples.length).toBe(2 * rate);
    let sum = 0;
    for (const s of samples) {
      expect(Number.isFinite(s)).toBe(true);
      expect(Math.abs(s)).toBeLessThanOrEqual(1);
      sum += s * s;
    }
    expect(Math.sqrt(sum / samples.length)).toBeGreaterThan(0.02);
  });
});
