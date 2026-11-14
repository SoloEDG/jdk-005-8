import assert from "node:assert";
import {
  generateWorld,
  findPath,
  MAP_W,
  MAP_H,
  tileId,
} from "../src/features/map/lib/world";

const tiles = generateWorld();
const byId = new Map(tiles.map((t) => [t.id, t]));
const isReclaimed = (id) => byId.get(id)?.terrain === "fertile";

// 模拟逐格开垦：每轮把所有当前可达的非沃土格全部开垦，直到没有新格子
let frontier = true;
let rounds = 0;
const reachable = new Set(tiles.filter((t) => t.terrain === "fertile").map((t) => t.id));
while (frontier && rounds < 50) {
  frontier = false;
  rounds++;
  for (const t of tiles) {
    if (t.terrain === "fertile" || reachable.has(t.id)) continue;
    const path = findPath(t, tiles, isReclaimed);
    if (path) {
      reachable.add(t.id);
      t.terrain = "fertile"; // 模拟开垦后变为沃土
      frontier = true;
    }
  }
}
assert.equal(
  reachable.size,
  MAP_W * MAP_H,
  `全图 ${MAP_W * MAP_H} 格应都可逐步开垦，实际可达 ${reachable.size}`,
);
console.log(`连通性测试通过：${rounds} 轮可开垦完全部 ${MAP_W * MAP_H} 格 ✅`);
