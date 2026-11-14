<script setup lang="ts">
import { computed } from "vue";
import type { DeepReadonly } from "vue";
import type { Contract, Job } from "../../../shared/contracts";
import { items } from "../../../shared/catalog";
import { recipes, recipeById } from "../lib/recipes";
import { queueProgress } from "../lib/schedule";
const props = defineProps<{
  jobs: readonly Readonly<Job>[];
  contracts: readonly DeepReadonly<Contract>[];
  hour: number;
}>();
defineEmits<{ enqueue: [recipe: string, contract?: string]; claim: [id: string] }>();
const dedicated = computed(() =>
  props.contracts.filter(
    (c) => c.status === "active" && recipes.some((r) => r.output === c.item),
  ),
);
const recipesFor = (c: DeepReadonly<Contract>) =>
  recipes.filter((r) => r.output === c.item);
</script>
<template>
  <section class="panel workshop-panel">
    <div class="panel-heading">
      <h2>手作工坊</h2>
      <span>单机顺序加工</span>
    </div>
    <div class="recipe-list">
      <button v-for="r in recipes" :key="r.id" @click="$emit('enqueue', r.id)">
        <b>{{ items[r.output].icon }}</b><strong>{{ r.name }}</strong
        ><small
          >{{ r.amount }} {{ items[r.input].name }} →
          {{ r.quantity }} 份<br />{{ r.duration }}h · ¥{{ r.cost }}</small
        ><span>＋ 制作</span>
      </button>
    </div>
    <div v-if="dedicated.length" class="dedicated">
      <small>合同专作 · 只使用专供原料，成品保留合同归属</small>
      <div v-for="c in dedicated" :key="c.id" class="dedicated-row">
        <span
          >📜 {{ c.id }} · 需 {{ items[c.item].name }} ×{{ c.quantity }}</span
        ><button
          v-for="r in recipesFor(c)"
          :key="r.id"
          @click="$emit('enqueue', r.id, c.id)"
        >
          ＋ {{ r.name }}
        </button>
      </div>
    </div>
    <div
      v-for="job in jobs.filter((j) => j.status !== 'claimed')"
      :key="job.id"
      class="job-row"
    >
      <span
        >{{ recipeById(job.recipe)?.name }} <small>{{ job.id }}</small
        ><em v-if="job.contract" class="tag">📜 {{ job.contract }}</em></span
      ><template v-if="job.status === 'queued'"
        ><progress
          :value="
            queueProgress(job.finish, hour, recipeById(job.recipe)!.duration)
          "
          max="100"
        ></progress
        ><small>还需 {{ job.finish - hour }}h</small></template
      ><button
        v-else-if="job.status === 'ready'"
        class="primary"
        @click="$emit('claim', job.id)"
      >
        领取成品 {{ "★".repeat(job.receipt?.quality ?? 1) }}</button
      ><small v-else>加工失败</small>
    </div>
    <p v-if="!jobs.some((j) => j.status !== 'claimed')" class="hint">
      机器空闲中，让丰收多一点价值。
    </p>
  </section>
</template>
