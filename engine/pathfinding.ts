// Поиск пути по сетке: персонажи обходят стены, а не упираются в них.
import { segmentHitsBox, type Box, type Circle, type PointXZ } from './math';

export interface NavObstacles {
  readonly boxes: readonly Box[];
  readonly circles: readonly Circle[];
  readonly bounds: Box;
}

const DIRECTIONS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/**
 * Сетка проходимости. Узел закрыт, если он ближе clearance к стене или дереву.
 * findPath ищет путь A* по восьми направлениям и спрямляет его: остаются только повороты.
 */
export class NavGrid {
  private readonly obstacles: NavObstacles;
  /** Насколько «толстый» тот, кто идёт по прямой (для проверки прямого прохода). */
  private readonly radius: number;
  private readonly cellSize: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(obstacles: NavObstacles, radius: number, clearance = radius + 0.1, cellSize = 0.5) {
    this.obstacles = obstacles;
    this.radius = radius;
    this.cellSize = cellSize;
    const { bounds } = obstacles;
    this.cols = Math.floor((bounds.maxX - bounds.minX) / cellSize) + 1;
    this.rows = Math.floor((bounds.maxZ - bounds.minZ) / cellSize) + 1;
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const p = this.point(row * this.cols + col);
        const nearBox = obstacles.boxes.some((b) => {
          const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
          const dz = Math.max(b.minZ - p.z, 0, p.z - b.maxZ);
          return dx * dx + dz * dz < clearance * clearance;
        });
        const nearCircle = obstacles.circles.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < c.radius + clearance);
        if (nearBox || nearCircle) this.blocked[row * this.cols + col] = 1;
      }
    }
  }

  /** Можно ли пройти из a в b по прямой, не задев стен. */
  clear(a: PointXZ, b: PointXZ): boolean {
    return !this.obstacles.boxes.some((box) => segmentHitsBox(a, b, box, this.radius));
  }

  /**
   * Точки пути из from в to (без самой from). Если дорога прямая — одна точка to.
   * null — пути нет (цель замурована).
   */
  findPath(from: PointXZ, to: PointXZ): PointXZ[] | null {
    if (this.clear(from, to)) return [{ x: to.x, z: to.z }];
    const start = this.nearestOpen(from);
    const goal = this.nearestOpen(to);
    if (start < 0 || goal < 0) return null;
    const nodes = this.search(start, goal);
    if (!nodes) return null;
    const route = nodes.map((node) => this.point(node));
    route.push({ x: to.x, z: to.z });
    return this.smooth(from, route);
  }

  /** A* по узлам сетки. Возвращает номера узлов от start (не включая) до goal. */
  private search(start: number, goal: number): number[] | null {
    const count = this.cols * this.rows;
    const cost = new Float64Array(count).fill(Infinity);
    const cameFrom = new Int32Array(count).fill(-1);
    const closed = new Uint8Array(count);
    const heap = new MinHeap();
    cost[start] = 0;
    heap.push(start, this.heuristic(start, goal));
    while (heap.size > 0) {
      const current = heap.pop();
      if (current === goal) break;
      if (closed[current]) continue;
      closed[current] = 1;
      const col = current % this.cols;
      const row = (current - col) / this.cols;
      for (const [dc, dr] of DIRECTIONS) {
        const c = col + dc;
        const r = row + dr;
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
        const next = r * this.cols + c;
        if (this.blocked[next] || closed[next]) continue;
        // по диагонали — только если оба соседних прохода открыты (не срезаем углы стен)
        if (dc !== 0 && dr !== 0 && (this.blocked[row * this.cols + c] || this.blocked[r * this.cols + col])) continue;
        const step = dc !== 0 && dr !== 0 ? Math.SQRT2 : 1;
        const candidate = cost[current] + step;
        if (candidate >= cost[next]) continue;
        cost[next] = candidate;
        cameFrom[next] = current;
        heap.push(next, candidate + this.heuristic(next, goal));
      }
    }
    if (start !== goal && cameFrom[goal] < 0) return null;
    const path: number[] = [];
    for (let node = goal; node !== start; node = cameFrom[node]) path.push(node);
    return path.reverse();
  }

  /** Оставляет только нужные повороты: идём к самой дальней точке, до которой видно напрямую. */
  private smooth(from: PointXZ, route: PointXZ[]): PointXZ[] {
    const result: PointXZ[] = [];
    let anchor = from;
    let index = 0;
    while (index < route.length) {
      let next = index;
      while (next + 1 < route.length && this.clear(anchor, route[next + 1])) next++;
      result.push(route[next]);
      anchor = route[next];
      index = next + 1;
    }
    return result;
  }

  /** Ближайший открытый узел (ищет по расширяющимся кольцам). −1 — рядом всё закрыто. */
  private nearestOpen(p: PointXZ): number {
    const col = Math.round((p.x - this.obstacles.bounds.minX) / this.cellSize);
    const row = Math.round((p.z - this.obstacles.bounds.minZ) / this.cellSize);
    let best = -1;
    let bestDistance = Infinity;
    for (let ring = 0; ring <= 6 && best < 0; ring++) {
      for (let r = row - ring; r <= row + ring; r++) {
        for (let c = col - ring; c <= col + ring; c++) {
          if (Math.max(Math.abs(r - row), Math.abs(c - col)) !== ring) continue;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const node = r * this.cols + c;
          if (this.blocked[node]) continue;
          const q = this.point(node);
          const distance = Math.hypot(q.x - p.x, q.z - p.z);
          if (distance < bestDistance) {
            best = node;
            bestDistance = distance;
          }
        }
      }
    }
    return best;
  }

  private point(node: number): PointXZ {
    const col = node % this.cols;
    const row = (node - col) / this.cols;
    return { x: this.obstacles.bounds.minX + col * this.cellSize, z: this.obstacles.bounds.minZ + row * this.cellSize };
  }

  private heuristic(a: number, b: number): number {
    const dc = Math.abs((a % this.cols) - (b % this.cols));
    const dr = Math.abs(Math.floor(a / this.cols) - Math.floor(b / this.cols));
    return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
  }
}

/** Двоичная куча узлов по приоритету (меньше — раньше). */
class MinHeap {
  private readonly nodes: number[] = [];
  private readonly priorities: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, priority: number): void {
    this.nodes.push(node);
    this.priorities.push(priority);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.priorities[parent] <= this.priorities[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const top = this.nodes[0];
    const lastNode = this.nodes.pop() as number;
    const lastPriority = this.priorities.pop() as number;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.priorities[0] = lastPriority;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.nodes.length && this.priorities[left] < this.priorities[smallest]) smallest = left;
        if (right < this.nodes.length && this.priorities[right] < this.priorities[smallest]) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
    [this.priorities[a], this.priorities[b]] = [this.priorities[b], this.priorities[a]];
  }
}
