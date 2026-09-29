import { describe, expect, it } from 'vitest';
import type { Circle, PointXZ } from '@engine/math';
import { CARPET, PLAYER } from './config';
import {
  FOREST_WALLS,
  GARDEN_PATH_X,
  GLADE,
  isOpen,
  LANDMARK_CIRCLES,
  onTrail,
  PIER,
  PIER_PATH_X,
  pondColliders,
  POND,
  PORTAL,
  PORTAL_XS,
  SPOTS,
  TRAIL,
  TRAILS,
  WALK_BOUNDS,
  WALK_LENGTH,
  walkAlong,
  walkPoint,
  YARD,
} from './layout';

const blockedBy = (circles: readonly Circle[], p: PointXZ) => circles.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < c.radius + PLAYER.radius);
const inWall = (p: PointXZ) => FOREST_WALLS.some((b) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ);

describe('карта мира', () => {
  it('в пруд не зайти, а по мосткам — можно до самого рыбака', () => {
    const water = pondColliders();
    expect(blockedBy(water, { x: POND.x + 1.5, z: POND.z })).toBe(true);
    expect(blockedBy(water, { x: POND.x, z: POND.z + 2 })).toBe(true);
    const middle = (PIER.minZ + PIER.maxZ) / 2;
    for (let x = PIER.minX + 0.2; x < SPOTS.fisher.x - 0.7; x += 0.25) expect(blockedBy(water, { x, z: middle })).toBe(false);
    // к мосткам ведёт тропинка с дорожки
    for (let z = 3; z > middle; z -= 0.5) expect(blockedBy(water, { x: PIER_PATH_X, z })).toBe(false);
  });

  it('тропинка из двора выводит на поляну, чаща вокруг закрыта', () => {
    const x = (TRAIL.minX + TRAIL.maxX) / 2;
    for (let z = YARD.minZ + 0.5; z > GLADE.minZ; z -= 0.5) {
      expect(isOpen({ x, z })).toBe(true);
      expect(inWall({ x, z })).toBe(false);
    }
    expect(inWall({ x: 20, z: -12 })).toBe(true);
    expect(inWall({ x: -40, z: -20 })).toBe(true);
    expect(isOpen({ x: 0, z: -40 })).toBe(false);
  });

  it('все пасхалки стоят там, куда можно дойти', () => {
    for (const spot of Object.values(SPOTS)) {
      expect(isOpen(spot)).toBe(true);
      expect(inWall(spot)).toBe(false);
      expect(spot.x).toBeGreaterThan(WALK_BOUNDS.minX);
      expect(spot.x).toBeLessThan(WALK_BOUNDS.maxX);
    }
    // рядом с каждой пасхалкой есть свободное место, откуда её можно потрогать
    const solid = [...LANDMARK_CIRCLES, ...pondColliders()];
    for (const spot of Object.values(SPOTS)) {
      const reachable = [0, 1, 2, 3, 4, 5, 6, 7].some((k) => {
        const angle = (k / 8) * Math.PI * 2;
        const p = { x: spot.x + Math.cos(angle) * 1.3, z: spot.z + Math.sin(angle) * 1.3 };
        return isOpen(p) && !inWall(p) && !blockedBy(solid, p);
      });
      expect(reachable).toBe(true);
    }
  });

  it('тропинки в огород и к пруду — во дворе', () => {
    for (const x of [GARDEN_PATH_X, PIER_PATH_X]) expect(isOpen({ x, z: 2 })).toBe(true);
  });

  it('тропинки начинаются под дорожкой, а к пасхалкам подходят вплотную', () => {
    const underCarpet = (p: PointXZ) => Math.abs(p.z - CARPET.z) < CARPET.width / 2;
    const starts = TRAILS.filter((t) => underCarpet(t.points[0]) || underCarpet(t.points[t.points.length - 1]));
    // к каждой бане, в лес, в огород и к пруду
    expect(starts.length).toBe(6);
    for (const spot of [SPOTS.well, SPOTS.hut, SPOTS.stone, SPOTS.campfire]) {
      const near = [0, 1, 2, 3, 4, 5, 6, 7].some((k) => onTrail({ x: spot.x + Math.cos(k * 0.8) * 1.2, z: spot.z + Math.sin(k * 0.8) * 1.2 }, 0.3));
      expect(near).toBe(true);
    }
  });
});

describe('путь по дорожке', () => {
  it('из западной воронки — на дорожку, по ней — в восточную воронку', () => {
    const [west, east] = PORTAL_XS;
    const start = walkPoint(0);
    expect(start.x).toBe(west);
    expect(start.z).toBeCloseTo(PORTAL.gateZ + 0.2);
    expect(walkPoint(walkAlong(0))).toEqual({ x: 0, z: CARPET.z });
    const end = walkPoint(WALK_LENGTH);
    expect(end.x).toBe(east);
    expect(end.z).toBeCloseTo(PORTAL.gateZ + 0.2);
  });

  it('идёт без рывков: соседние точки рядом', () => {
    for (let along = 0; along < WALK_LENGTH; along += 0.25) {
      const a = walkPoint(along);
      const b = walkPoint(along + 0.25);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThanOrEqual(0.2501);
    }
  });
});

