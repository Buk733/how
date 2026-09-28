import * as THREE from 'three';

/** HTML-подпись, привязанная к точке в 3D-мире (текст остаётся чётким при пиксельном рендере). */
export class Label {
  readonly element: HTMLDivElement;
  /** Точка мира, над которой висит подпись (низ подписи). */
  readonly anchor = new THREE.Vector3();
  visible = true;
  private readonly layer: LabelLayer;

  constructor(layer: LabelLayer, className: string) {
    this.layer = layer;
    this.element = document.createElement('div');
    this.element.className = className;
  }

  remove(): void {
    this.layer.forget(this);
    this.element.remove();
  }
}

/** Слой подписей поверх холста: каждый кадр переводит 3D-точки в экранные координаты. */
export class LabelLayer {
  readonly root: HTMLDivElement;
  private readonly labels = new Set<Label>();
  private readonly projected = new THREE.Vector3();

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    Object.assign(this.root.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    container.append(this.root);
  }

  create(className: string): Label {
    const label = new Label(this, className);
    this.root.append(label.element);
    this.labels.add(label);
    return label;
  }

  /** Всплывающий текст («+120»), который сам исчезнет через duration мс. */
  float(text: string, position: THREE.Vector3, className: string, duration = 1100): void {
    const label = this.create(className);
    label.element.textContent = text;
    label.anchor.copy(position);
    window.setTimeout(() => label.remove(), duration);
  }

  forget(label: Label): void {
    this.labels.delete(label);
  }

  update(camera: THREE.Camera, width: number, height: number): void {
    for (const label of this.labels) {
      const p = this.projected.copy(label.anchor).project(camera);
      const onScreen = label.visible && p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      label.element.style.display = onScreen ? '' : 'none';
      if (!onScreen) continue;
      const x = ((p.x + 1) / 2) * width;
      const y = ((1 - p.y) / 2) * height;
      label.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
}
