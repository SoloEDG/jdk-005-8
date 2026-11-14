<script setup lang="ts">
import { computed } from "vue";
import type { Item, Plot } from "../../../shared/contracts";
import { items } from "../../../shared/catalog";
import { crops, ready } from "../lib/crops";
const props = defineProps<{
  plots: readonly Readonly<Plot>[];
  selected: Item;
  activePlotId: string;
}>();
defineEmits<{
  select: [item: Item];
  plant: [id: string];
  water: [id: string];
  harvest: [id: string];
}>();
const seeds: Item[] = ["carrot", "corn", "berry"];
const activePlot = computed(
  () => props.plots.find((p) => p.id === props.activePlotId) ?? props.plots[0],
);
const activeIndex = computed(() =>
  props.plots.findIndex((p) => p.id === activePlot.value?.id),
);
</script>
<template>
  <section class="panel seed-panel">
    <div class="panel-heading">
      <h2>土地与种植</h2>
      <span>{{ plots.length }} 块沃土 · 持续开垦中</span>
    </div>
    <div class="seed-list">
      <button
        v-for="item in seeds"
        :key="item"
        :class="{ selected: selected === item }"
        @click="$emit('select', item)"
      >
        <b>{{ items[item].icon }}</b><strong>{{ items[item].name }}</strong
        ><small>{{ crops[item]?.duration }}h · ¥{{ crops[item]?.cost }}</small>
      </button>
    </div>
    <div class="plot-details" v-if="activePlot">
      <strong>土地 {{ activeIndex + 1 }} <small>{{ activePlot.id }}</small></strong
      ><template v-if="activePlot.crop"
        ><span
          >生长 {{ activePlot.crop.growth.toFixed(1) }} /
          {{ crops[activePlot.crop.item]?.duration }}h · 水分
          {{ activePlot.crop.water }}%</span
        ><button @click="$emit('water', activePlot.id)">浇水 +</button
        ><button
          :disabled="!ready(activePlot.crop)"
          @click="$emit('harvest', activePlot.id)"
        >
          收获作物
        </button></template
      ><template v-else
        ><span>翻好的土地，等待新种子</span
        ><button class="primary" @click="$emit('plant', activePlot.id)">
          播种 {{ items[selected].name }}
        </button></template
      >
    </div>
  </section>
</template>
