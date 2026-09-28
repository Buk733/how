import { describe, expect, it } from 'vitest';
import { Animator } from './animation';

describe('Animator', () => {
  const walk = { frames: [0, 1, 2, 3], fps: 10 };

  it('листает кадры по времени и зацикливается', () => {
    const animator = new Animator(walk);
    expect(animator.frame).toBe(0);
    animator.update(0.25);
    expect(animator.frame).toBe(2);
    animator.update(0.2);
    expect(animator.frame).toBe(0);
  });

  it('не перезапускает анимацию, которая уже играет', () => {
    const animator = new Animator(walk);
    animator.update(0.15);
    animator.play(walk);
    expect(animator.frame).toBe(1);
  });

  it('неповторяющаяся анимация останавливается на последнем кадре', () => {
    const animator = new Animator({ frames: [5, 6], fps: 10, loop: false });
    animator.update(1);
    expect(animator.frame).toBe(6);
    expect(animator.finished).toBe(true);
  });
});
