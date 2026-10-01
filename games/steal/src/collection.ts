// Альбом коллекции без графики: кого игрок уже получал — обычного и «Голду».
import { CHARACTERS, type CharacterDef } from './data/characters';
import type { SaveData } from './save';

/** Ключ в альбоме: «id» или «id:gold». */
export function collectionKey(id: string, gold: boolean): string {
  return gold ? `${id}:gold` : id;
}

export function hasCollected(save: SaveData, id: string, gold: boolean): boolean {
  return save.collection.includes(collectionKey(id, gold));
}

/** Отмечает персонажа в альбоме. true — его там ещё не было (новая карточка). */
export function addToCollection(save: SaveData, def: CharacterDef, gold: boolean): boolean {
  const key = collectionKey(def.id, gold);
  if (save.collection.includes(key)) return false;
  save.collection.push(key);
  return true;
}

/** Открыта ли карточка персонажа: получен обычным или «Голдой». */
export function isFound(save: SaveData, id: string): boolean {
  return hasCollected(save, id, false) || hasCollected(save, id, true);
}

export interface CollectionProgress {
  /** Сколько карточек открыто (обычным или «Голдой») и сколько персонажей получено «Голдой». */
  readonly found: number;
  readonly gold: number;
  readonly total: number;
}

export function collectionProgress(save: SaveData, characters: readonly CharacterDef[] = CHARACTERS): CollectionProgress {
  return {
    found: characters.filter((c) => isFound(save, c.id)).length,
    gold: characters.filter((c) => hasCollected(save, c.id, true)).length,
    total: characters.length,
  };
}
