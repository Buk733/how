import type * as THREE from 'three';
import type { Label } from '@engine/labels';

/** Реплика над головой: «Эй!», «Стой, ворюга!» — показывается несколько секунд и гаснет. */
export class SpeechBubble {
  readonly label: Label;
  private timer = 0;

  constructor(label: Label) {
    this.label = label;
    this.label.visible = false;
  }

  get visible(): boolean {
    return this.timer > 0;
  }

  /** Сказать фразу (или одну из нескольких — случайную). */
  say(text: string | readonly string[], seconds = 1.8): void {
    const line = typeof text === 'string' ? text : text[Math.floor(Math.random() * text.length)];
    if (!line) return;
    this.label.element.textContent = line;
    // перезапуск анимации появления
    this.label.element.classList.remove('pop');
    void this.label.element.offsetWidth;
    this.label.element.classList.add('pop');
    this.label.visible = true;
    this.timer = seconds;
  }

  hide(): void {
    this.timer = 0;
    this.label.visible = false;
  }

  /** Держит пузырь над точкой head и гасит его, когда время вышло. */
  update(dt: number, head: THREE.Vector3): void {
    if (this.timer <= 0) return;
    this.timer -= dt;
    this.label.anchor.copy(head);
    if (this.timer <= 0) this.label.visible = false;
  }

  remove(): void {
    this.label.remove();
  }
}
