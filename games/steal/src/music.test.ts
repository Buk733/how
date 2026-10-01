import { describe, expect, it } from 'vitest';
import { parseNotes, renderSong, songDuration } from '@engine/chiptune';
import { BANYA_POLKA } from './music';

describe('фоновая мелодия', () => {
  it('все дорожки одной длины — 16 тактов по 8 шагов, ноты записаны без ошибок', () => {
    for (const track of BANYA_POLKA.tracks) expect(parseNotes(track.notes).steps).toBe(16 * 8);
  });

  it('звучит мягко: без квадратных «пищащих» голосов, мелодия — синусоида с плавной атакой, есть эхо', () => {
    for (const track of BANYA_POLKA.tracks) expect(track.wave).not.toBe('pulse');
    const lead = BANYA_POLKA.tracks[0];
    expect(lead.wave).toBe('sine');
    expect(lead.attack).toBeGreaterThanOrEqual(0.03);
    expect(lead.release).toBeGreaterThanOrEqual(0.15);
    expect(BANYA_POLKA.echo).toBeDefined();
  });

  it('синтезируется без тишины и без перегруза', () => {
    const samples = renderSong(BANYA_POLKA, 8000);
    let sum = 0;
    let peak = 0;
    for (const s of samples) {
      sum += s * s;
      peak = Math.max(peak, Math.abs(s));
    }
    expect(Math.sqrt(sum / samples.length)).toBeGreaterThan(0.02);
    expect(peak).toBeLessThanOrEqual(1);
  });

  it('длится около полуминуты, чтобы не надоедать', () => {
    expect(songDuration(BANYA_POLKA)).toBeGreaterThan(25);
    expect(songDuration(BANYA_POLKA)).toBeLessThan(45);
  });
});
