import { describe, expect, it } from 'vitest';
import { parseNotes, songDuration } from '@engine/chiptune';
import { BANYA_POLKA } from './music';

describe('фоновая мелодия', () => {
  it('все дорожки одной длины — 16 тактов по 8 шагов, ноты записаны без ошибок', () => {
    for (const track of BANYA_POLKA.tracks) expect(parseNotes(track.notes).steps).toBe(16 * 8);
  });

  it('длится около полуминуты, чтобы не надоедать', () => {
    expect(songDuration(BANYA_POLKA)).toBeGreaterThan(25);
    expect(songDuration(BANYA_POLKA)).toBeLessThan(45);
  });
});
