import * as THREE from 'three';

/** HTML-подпись, привязанная к точке в 3D-мире (текст остаётся чётким при пиксельном рендере). */
export class Label {
  readonly element: HTMLDivElement;
  /** Точка мира, над которой висит подпись (низ подписи). */
  readonly anchor = new THREE.Vector3();
  visible = true;
  /** Если точка за краем экрана — прижать подпись к краю (стрелка-указатель), а не прятать. */
  pinToEdge = false;
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
  /** Камера и размер слоя с прошлого кадра — для toScreen. */
  private camera: THREE.Camera | null = null;
  private width = 0;
  private height = 0;

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

  /** Где точка мира на экране (в пикселях слоя) по камере прошлого кадра; null — за камерой. */
  toScreen(position: THREE.Vector3): { x: number; y: number } | null {
    if (!this.camera) return null;
    const p = this.projected.copy(position).project(this.camera);
    if (p.z >= 1) return null;
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height };
  }

  update(camera: THREE.Camera, width: number, height: number): void {
    this.camera = camera;
    this.width = width;
    this.height = height;
    for (const label of this.labels) {
      const p = this.projected.copy(label.anchor).project(camera);
      const inView = p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2;
      const offEdge = p.z >= 1 || Math.abs(p.x) > 0.92 || Math.abs(p.y) > 0.9;
      const pinned = label.visible && label.pinToEdge && offEdge;
      const shown = label.visible && (inView || pinned);
      label.element.style.display = shown ? '' : 'none';
      label.element.classList.toggle('edge', pinned);
      if (!shown) continue;
      if (pinned) {
        // прижимаем к краю по направлению от центра экрана к цели
        const scale = 1 / Math.max(Math.abs(p.x) / 0.85, Math.abs(p.y) / 0.8, 1);
        p.x *= scale;
        p.y *= scale;
      }
      const x = ((p.x + 1) / 2) * width;
      const y = ((1 - p.y) / 2) * height;
      label.element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
}
