// Мемные порталы на концах дорожки. Дорожка кончается на круглой каменной площадке с рунами,
// за площадкой — ворота лицом к камере, в воротах крутится воронка: из западной персонажи
// выходят на дорожку, в восточную уходят. Картинки граней — tools/art/vehicles.mjs.
import * as THREE from 'three';
import { BoxModel } from '@engine/boxes';
import type { Circle } from '@engine/math';
import { CARPET } from './config';
import { PORTAL, PORTAL_XS } from './layout';

/** Картинки порталов: textures/<имя>.png. */
export const PORTAL_TEXTURES = ['portal-pad', 'portal-swirl', 'gate-post', 'gate-beam', 'gate-sign'] as const;
export type PortalTextures = Record<(typeof PORTAL_TEXTURES)[number], THREE.Texture>;

/** Ворота: столбы 0.5×3, балка 3×0.5, доска для надписи 2×0.625 (по 16 пикселей на единицу). */
const GATE = { postSize: 0.5, postHeight: 3, beamY: 3.1, beamDepth: 0.6, signY: 2.54, signWidth: 2, signHeight: 0.625 } as const;
/** Сколько шагов на оборот воронки: крутится рывками, как анимированный спрайт, — пиксели не рябят. */
const SWIRL_STEPS = 16;

export interface Portals {
  /** Столбы ворот — в них упираются. */
  readonly circles: readonly Circle[];
  /** Где висит доска с надписью (для подписи). */
  readonly signs: readonly THREE.Vector3[];
  update(dt: number): void;
}

export function buildPortals(scene: THREE.Scene, textures: PortalTextures): Portals {
  const t = textures;
  const circles: Circle[] = [];
  const signs: THREE.Vector3[] = [];
  /** Воронки: в воротах крутится вокруг z, отражение на площадке — вокруг y. */
  const swirls: { mesh: THREE.Mesh; speed: number; flat: boolean }[] = [];

  // общие для обоих порталов геометрии и материалы
  const gate = gateGeometry();
  // свет «запечён» в цвет вершин ворот (BoxModel)
  const gateMaterials = [
    ...[t['gate-post'], t['gate-beam'], t['gate-sign']].map((map) => new THREE.MeshBasicMaterial({ map, vertexColors: true })),
    ...['#ffd23f', '#8a5a44', '#94b0c2'].map((color) => new THREE.MeshBasicMaterial({ color, vertexColors: true })),
  ];
  const pad = new THREE.MeshBasicMaterial({ map: t['portal-pad'], alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const rim = new THREE.MeshBasicMaterial({ color: '#566c86' });
  const swirl = new THREE.MeshBasicMaterial({ map: t['portal-swirl'], alphaTest: 0.5 });
  // отражение воронки на площадке — приглушённое
  const glow = new THREE.MeshBasicMaterial({ map: t['portal-swirl'], alphaTest: 0.5, color: '#8878b8', polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });

  PORTAL_XS.forEach((x, i) => {
    // площадка: плоский круг поверх конца дорожки и низкий каменный бортик
    const disc = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.padRadius, 40).rotateX(-Math.PI / 2), pad);
    disc.position.set(x, 0.014, CARPET.z);
    const border = new THREE.Mesh(new THREE.CylinderGeometry(PORTAL.padRadius, PORTAL.padRadius + 0.04, 0.09, 40, 1, true), rim);
    border.position.set(x, 0.045, CARPET.z);
    const reflection = new THREE.Mesh(new THREE.CircleGeometry(1.05, 32).rotateX(-Math.PI / 2), glow);
    reflection.position.set(x, 0.016, CARPET.z);
    swirls.push({ mesh: reflection, speed: i ? 0.35 : -0.35, flat: true });

    // ворота и воронка в них — лицом к камере
    const frame = new THREE.Mesh(gate, gateMaterials);
    frame.position.set(x, 0, PORTAL.gateZ);
    const vortex = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.swirlRadius, 32), swirl);
    swirls.push({ mesh: vortex, speed: i ? -0.5 : 0.5, flat: false });
    // воронка вытянута по высоте проёма, как дверь; крутится внутри неподвижного овала
    const doorway = new THREE.Group().add(vortex);
    doorway.position.set(x, PORTAL.swirlY, PORTAL.gateZ + 0.02);
    doorway.scale.y = 1.25;
    scene.add(disc, border, reflection, frame, doorway);

    for (const side of [-1, 1]) circles.push({ x: x + side * PORTAL.postX, z: PORTAL.gateZ, radius: 0.35 });
    signs.push(new THREE.Vector3(x, GATE.signY, PORTAL.gateZ + 0.35));
  });

  let time = 0;
  return {
    circles,
    signs,
    update: (dt) => {
      time += dt;
      for (const s of swirls) {
        const turn = (Math.floor(time * s.speed * SWIRL_STEPS) / SWIRL_STEPS) * Math.PI * 2;
        if (s.flat) s.mesh.rotation.y = turn;
        else s.mesh.rotation.z = turn;
      }
    },
  };
}

/** Ворота: два столба на каменных подставках, балка с золотыми торцами и доска под ней. */
function gateGeometry(): THREE.BufferGeometry {
  const [POST, BEAM, SIGN, GOLD, WOOD, STONE] = [0, 1, 2, 3, 4, 5];
  const all = (m: number) => ({ near: [m], far: [m], front: [m], back: [m], top: [m] }) as const;
  const model = new BoxModel();
  for (const side of [-1, 1]) {
    const x = side * PORTAL.postX;
    model.box([GATE.postSize, GATE.postHeight, GATE.postSize], [x, GATE.postHeight / 2, 0], all(POST));
    model.box([0.8, 0.22, 0.8], [x, 0.11, 0], all(STONE));
  }
  return model
    .box([3, 0.5, GATE.beamDepth], [0, GATE.beamY, 0], { near: [BEAM], far: [BEAM], top: [BEAM], front: [GOLD], back: [GOLD] })
    .box([GATE.signWidth, GATE.signHeight, 0.08], [0, GATE.signY, 0.3], { near: [SIGN], far: [SIGN], top: [WOOD], front: [WOOD], back: [WOOD] })
    .build();
}
