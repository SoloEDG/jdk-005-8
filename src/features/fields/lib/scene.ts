import type { Plot, TerrainTile, DeepReadonly } from "../../../shared/contracts";
import { crops } from "./crops";
import {
  CHUNK_SIZE,
  MAP_W,
  MAP_H,
  chunkIndex,
  chunkCount,
  chunkName,
  tileId,
} from "../../map/lib/world";
export function growthStage(plot: Readonly<Plot>) {
  if (!plot.crop) return 0;
  return Math.min(
    3,
    1 + Math.floor(plot.crop.growth / (crops[plot.crop.item]!.duration / 3)),
  );
}

export { chunkIndex, chunkCount, chunkName, tileId };

/** 当前分块内的格子（分块加载：只渲染聚焦区块） */
export function tilesInChunk(
  tiles: readonly DeepReadonly<TerrainTile>[],
  chunk: number,
): DeepReadonly<TerrainTile>[] {
  const cols = Math.ceil(MAP_W / CHUNK_SIZE);
  const cx = chunk % cols;
  const cy = Math.floor(chunk / cols);
  const x0 = cx * CHUNK_SIZE;
  const y0 = cy * CHUNK_SIZE;
  return tiles.filter(
    (t) =>
      t.x >= x0 &&
      t.x < x0 + CHUNK_SIZE &&
      t.y >= y0 &&
      t.y < y0 + CHUNK_SIZE &&
      t.x < MAP_W &&
      t.y < MAP_H,
  );
}

export const terrainMeta: Record<
  TerrainTile["terrain"],
  { name: string; icon: string; cls: string }
> = {
  fertile: { name: "沃土", icon: "", cls: "terrain-fertile" },
  grass: { name: "草地", icon: "🌿", cls: "terrain-grass" },
  wasteland: { name: "荒地", icon: "⛰", cls: "terrain-wasteland" },
  rocky: { name: "石块", icon: "🪨", cls: "terrain-rocky" },
  forest: { name: "树林", icon: "🌲", cls: "terrain-forest" },
};

export const projectStatusMeta = {
  planned: { name: "等待工具", cls: "st-planned" },
  ready: { name: "可开工", cls: "st-ready" },
  building: { name: "施工中", cls: "st-building" },
  done: { name: "已完成", cls: "st-done" },
} as const;
