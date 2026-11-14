<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  Plot,
  ReclaimProject,
  TerrainTile,
  DeepReadonly,
} from "../../../shared/contracts";
import { items } from "../../../shared/catalog";
import {
  tilesInChunk,
  terrainMeta,
  projectStatusMeta,
  chunkCount,
  chunkName,
  chunkIndex,
} from "../../fields/lib/scene";
import { reclaimRecipe, findPath } from "../lib/world";

const props = defineProps<{
  tiles: readonly DeepReadonly<TerrainTile>[];
  plots: readonly DeepReadonly<Plot>[];
  projects: readonly DeepReadonly<ReclaimProject>[];
  hour: number;
  activePlotId: string;
}>();
const emit = defineEmits<{
  selectPlot: [id: string];
  preview: [tileId: string];
  plan: [tileId: string];
  cancel: [id: string];
  start: [id: string];
}>();

const centerChunk = chunkIndex(4, 4);
const focusedChunk = ref(centerChunk);
const hoverId = ref<string | null>(null);

const chunkTiles = computed(() => tilesInChunk(props.tiles, focusedChunk.value));
const projectByTile = computed(() => {
  const map = new Map<string, DeepReadonly<ReclaimProject>>();
  for (const p of props.projects) map.set(p.tileId, p);
  return map;
});
const plotByTile = computed(() => {
  const map = new Map<string, DeepReadonly<Plot>>();
  for (const p of props.plots) map.set(p.id.replace("p", "t"), p);
  return map;
});
const isReclaimed = (id: string) =>
  props.tiles.find((t) => t.id === id)?.terrain === "fertile";

const preview = computed(() => {
  const id = hoverId.value;
  if (!id) return null;
  const tile = props.tiles.find((t) => t.id === id);
  if (!tile || tile.terrain === "fertile" || projectByTile.value.has(id))
    return null;
  const path = findPath(tile, props.tiles, isReclaimed);
  if (!path) return { tile, recipe: reclaimRecipe(tile), path: null };
  return { tile, recipe: reclaimRecipe(tile), path };
});
const pathSet = computed(() => new Set(preview.value?.path ?? []));

function clickTile(tile: TerrainTile) {
  if (tile.terrain === "fertile") {
    const plot = plotByTile.value.get(tile.id);
    if (plot) emit("selectPlot", plot.id);
    return;
  }
  hoverId.value = tile.id;
  emit("preview", tile.id);
}
</script>
<template>
  <section class="panel map-panel">
    <div class="panel-heading">
      <h2>开垦地图</h2>
      <span>分块加载 · 共 {{ chunkCount() }} 个区块</span>
    </div>
    <div class="chunk-tabs">
      <button
        v-for="i in chunkCount()"
        :key="i"
        :class="{ active: focusedChunk === i - 1 }"
        @click="focusedChunk = i - 1"
      >
        {{ chunkName(i - 1) }}
      </button>
    </div>
    <div class="map-grid">
      <button
        v-for="tile in chunkTiles"
        :key="tile.id"
        class="map-tile"
        :class="[
          terrainMeta[tile.terrain].cls,
          {
            'is-path': pathSet.has(tile.id),
            'is-hover': hoverId === tile.id,
            'is-active-plot':
              tile.terrain === 'fertile' &&
              plotByTile.get(tile.id)?.id === activePlotId,
          },
        ]"
        @mouseenter="hoverId = tile.id"
        @mouseleave="hoverId = null"
        @click="clickTile(tile)"
      >
        <template v-if="tile.terrain === 'fertile'">
          <span class="fertile-mark">▦</span>
          <i v-if="plotByTile.get(tile.id)?.crop" class="mini-crop">
            {{ items[plotByTile.get(tile.id)!.crop!.item].icon }}
          </i>
        </template>
        <template v-else>
          <span class="terrain-icon">{{ terrainMeta[tile.terrain].icon }}</span>
          <em v-if="tile.elevation" class="elevation">Lv{{ tile.elevation }}</em>
        </template>
        <b v-if="projectByTile.get(tile.id)" class="project-flag" :class="projectStatusMeta[projectByTile.get(tile.id)!.status].cls">
          {{ projectStatusMeta[projectByTile.get(tile.id)!.status].name }}
        </b>
      </button>
    </div>

    <div v-if="preview" class="reclaim-preview">
      <div class="preview-head">
        <strong>
          {{ terrainMeta[preview.tile.terrain].icon }}
          {{ terrainMeta[preview.tile.terrain].name }}
          <small>{{ preview.tile.id }}</small>
        </strong>
        <span class="preview-label">{{ preview.recipe.label }}</span>
      </div>
      <p v-if="!preview.path" class="preview-warn">
        路径不可达：需要先开垦与已开垦沃土相邻的格子
      </p>
      <template v-else>
        <div class="preview-stats">
          <span>🛠 {{ items[preview.recipe.tool].icon }} ×{{ preview.recipe.toolQty }}</span>
          <span>💰 ¥{{ preview.recipe.coinCost }}</span>
          <span>⏱ {{ preview.recipe.duration }}h</span>
          <span>🧭 路径 {{ preview.path.length }} 格</span>
        </div>
        <p class="preview-note">确认后先托管资金并登记工具占用，工具到货才能开工</p>
        <div class="preview-actions">
          <button class="primary" @click="emit('plan', preview.tile.id)">
            确认开垦计划
          </button>
        </div>
      </template>
    </div>

    <div v-if="projects.length" class="project-list">
      <div
        v-for="p in projects"
        :key="p.id"
        class="project-row"
        :class="projectStatusMeta[p.status].cls"
      >
        <div>
          <strong>{{ p.tileId }}</strong>
          <small>
            {{ items[p.tool].icon }} ×{{ p.toolQty }} · 托管 ¥{{ p.escrow }}
            <template v-if="p.status === 'building'">
              · 还需 {{ Math.max(0, (p.finish ?? hour) - hour) }}h
            </template>
          </small>
        </div>
        <span class="status-tag">{{ projectStatusMeta[p.status].name }}</span>
        <button
          v-if="p.status === 'ready'"
          class="primary"
          @click="emit('start', p.id)"
        >
          开工
        </button>
        <button
          v-if="p.status === 'planned' || p.status === 'ready'"
          @click="emit('cancel', p.id)"
        >
          取消退款
        </button>
      </div>
    </div>
  </section>
</template>
