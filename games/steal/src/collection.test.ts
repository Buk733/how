import { describe, expect, it } from 'vitest';
import { addToCollection, collectionProgress, hasCollected, isFound } from './collection';
import { CHARACTERS, characterById } from './data/characters';
import { createSave } from './save';

const def = (id: string) => {
  const found = characterById(id);
  if (!found) throw new Error(id);
  return found;
};

describe('альбом', () => {
  it('новая карточка — один раз, «Голда» отдельно', () => {
    const save = createSave();
    expect(addToCollection(save, def('kotost'), false)).toBe(true);
    expect(addToCollection(save, def('kotost'), false)).toBe(false);
    expect(addToCollection(save, def('kotost'), true)).toBe(true);
    expect(save.collection).toEqual(['kotost', 'kotost:gold']);
    expect(hasCollected(save, 'kotost', true)).toBe(true);
  });

  it('карточка открыта, даже если получена только «Голда»', () => {
    const save = createSave();
    addToCollection(save, def('hamam'), true);
    expect(isFound(save, 'hamam')).toBe(true);
    expect(hasCollected(save, 'hamam', false)).toBe(false);
    expect(collectionProgress(save)).toEqual({ found: 1, gold: 1, total: CHARACTERS.length });
  });
});
