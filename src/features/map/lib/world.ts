import type {
  Item,
  TerrainTile,
  TerrainType,
  ReclaimProject,
  DeepReadonly,
} from "../../../shared/contracts";

export const MAP_W = 9;
export const MAP_H = 9;
export const CHUNK_SIZE = 3;
/** 初始 12 块沃土所在的中心矩形（4 列 × 3 行） */
export const HOME_RECT = { x0: 3, y0: 3, x1: 6, y1: 5 };

/** 坐标推导的稳定格子 ID，地图扩宽后旧坐标身份保持不变 */
export const tileId = (x: number, y: number) => `t${x}-${y}`;
export const parseTileId = (id: string) => {
  const [x, y] = id.slice(1).split("-").map(Number);
  return { x, y };
};
/** 田块稳定 ID，与格子坐标一一绑定 */
export const plotIdOf = (x: number, y: number) => `p${x}-${y}`;
export const chunkIndex = (x: number, y: number) =>
  Math.floor(y / CHUNK_SIZE) * Math.ceil(MAP_W / CHUNK_SIZE) +
  Math.floor(x / CHUNK_SIZE);
export const chunkCount = () =>
  Math.ceil(MAP_W / CHUNK_SIZE) * Math.ceil(MAP_H / CHUNK_SIZE);
export const chunkName = (index: number) => {
  const cols = Math.ceil(MAP_W / CHUNK_SIZE);
  return `${Math.floor(index / cols) + 1} 区 · 第 ${(index % cols) + 1} 块`;
};

/** 基于坐标的确定性伪随机，保证同一张地图每次生成结果一致 */
function hash(x: number, y: number, salt: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function isHomeTile(x: number, y: number) {
  return (
    x >= HOME_RECT.x0 &&
    x <= HOME_RECT.x1 &&
    y >= HOME_RECT.y0 &&
    y <= HOME_RECT.y1
  );
}

/** 生成整张地图的固定地貌 */
export function generateWorld(): TerrainTile[] {
  const tiles: TerrainTile[] = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (isHomeTile(x, y)) {
        tiles.push({ id: tileId(x, y), x, y, terrain: "fertile", elevation: 0 });
        continue;
      }
      const roll = hash(x, y, 1);
      let terrain: TerrainType;
      if (roll < 0.3) terrain = "forest";
      else if (roll < 0.52) terrain = "rocky";
      else if (roll < 0.78) terrain = "wasteland";
      else terrain = "grass";
      const elevation =
        terrain === "wasteland" ? 1 + Math.floor(hash(x, y, 2) * 3) : 0;
      tiles.push({ id: tileId(x, y), x, y, terrain, elevation });
    }
  return tiles;
}

export interface ReclaimRecipe {
  tool: Item;
  toolQty: number;
  coinCost: number;
  duration: number;
  label: string;
}

/** 各地貌的开垦配方：工具、资金与工期（荒地随高度增加） */
export function reclaimRecipe(tile: DeepReadonly<TerrainTile>): ReclaimRecipe {
  switch (tile.terrain) {
    case "forest":
      return { tool: "axe", toolQty: 1, coinCost: 35, duration: 6, label: "砍伐树林" };
    case "rocky":
      return { tool: "pick", toolQty: 1, coinCost: 45, duration: 8, label: "清理石块" };
    case "wasteland":
      return {
        tool: "shovel",
        toolQty: 1,
        coinCost: 25 + tile.elevation * 10,
        duration: 4 + tile.elevation * 2,
        label: `整平 ${tile.elevation} 级荒地`,
      };
    case "grass":
      return { tool: "shovel", toolQty: 1, coinCost: 20, duration: 4, label: "开垦草地" };
    default:
      return { tool: "shovel", toolQty: 1, coinCost: 0, duration: 0, label: "已开垦" };
  }
}

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/**
 * 预览施工路径：从已开垦（沃土）格子 BFS 到目标相邻格，再踏上目标。
 * 路径在确认计划时冻结，保证施工期间地图状态变化不影响已确认路径。
 */
export function findPath(
  target: DeepReadonly<TerrainTile>,
  tiles: readonly DeepReadonly<TerrainTile>[],
  isReclaimed: (id: string) => boolean,
): string[] | null {
  const grid = new Map<string, DeepReadonly<TerrainTile>>(
    tiles.map((t) => [t.id, t]),
  );
  const inBounds = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const queue: DeepReadonly<TerrainTile>[] = [];
  const prev = new Map<string, string>();
  for (const t of tiles)
    if (t.terrain === "fertile" && isReclaimed(t.id)) queue.push(t);
  if (!queue.length) return null;
  const reached = new Set(queue.map((t) => t.id));
  let gateway: DeepReadonly<TerrainTile> | null = null;
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(nx, ny)) continue;
      const nid = tileId(nx, ny);
      if (nid === target.id) {
        gateway = cur;
        queue.length = 0;
        break;
      }
      const next = grid.get(nid);
      if (!next || next.terrain !== "fertile" || !isReclaimed(nid)) continue;
      if (reached.has(nid)) continue;
      reached.add(nid);
      prev.set(nid, cur.id);
      queue.push(next);
    }
  }
  if (!gateway) return null;
  const path = [target.id];
  let cursor: string | undefined = gateway.id;
  while (cursor) {
    path.unshift(cursor);
    cursor = prev.get(cursor);
  }
  return path;
}

/** 该格子当前是否被一个未结束的开垦计划占用 */
export const tileBusy = (
  projects: readonly DeepReadonly<ReclaimProject>[],
  id: string,
) =>
  projects.some(
    (p) =>
      p.tileId === id &&
      (p.status === "planned" || p.status === "ready" || p.status === "building"),
  );
