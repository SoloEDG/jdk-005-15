<script setup lang="ts">
import { computed } from "vue";
import type { DeepReadonly } from "vue";
import type { Contract, Item, Plot } from "../../../shared/contracts";
import { items } from "../../../shared/catalog";
import { crops, ready } from "../lib/crops";
const props = defineProps<{
  plots: readonly Readonly<Plot>[];
  selected: Item;
  active: number;
  contracts: readonly DeepReadonly<Contract>[];
}>();
defineEmits<{
  select: [item: Item];
  plant: [id: number];
  water: [id: number];
  harvest: [id: number];
}>();
const seeds: Item[] = ["carrot", "corn", "berry"];
const bound = computed(() => {
  const id = props.plots[props.active]?.contract;
  return props.contracts.find((c) => c.id === id && c.status === "active");
});
</script>
<template>
  <section class="panel seed-panel">
    <div class="panel-heading">
      <h2>土地与种植</h2>
      <span>12 块沃土</span>
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
    <div class="plot-details">
      <strong>土地 {{ active + 1 }}</strong
      ><template v-if="plots[active]?.crop"
        ><span
          >生长 {{ plots[active]!.crop!.growth.toFixed(1) }} /
          {{ crops[plots[active]!.crop!.item]?.duration }}h · 水分
          {{ plots[active]!.crop!.water }}%
          <em v-if="plots[active]!.contract" class="tag"
            >📜 {{ plots[active]!.contract }}</em
          ></span
        ><button @click="$emit('water', active)">浇水 +</button
        ><button
          :disabled="!ready(plots[active]!.crop!)"
          @click="$emit('harvest', active)"
        >
          收获作物
        </button></template
      ><template v-else-if="bound"
        ><span>合同田块 · 按约种植 {{ items[bound.crop].name }}</span
        ><button class="primary" @click="$emit('plant', active)">
          播种 {{ items[bound.crop].name }}
        </button></template
      ><template v-else
        ><span>翻好的土地，等待新种子</span
        ><button class="primary" @click="$emit('plant', active)">
          播种 {{ items[selected].name }}
        </button></template
      >
    </div>
  </section>
</template>
