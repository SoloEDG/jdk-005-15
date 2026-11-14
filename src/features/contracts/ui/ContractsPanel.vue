<script setup lang="ts">
import { reactive } from "vue";
import type { DeepReadonly } from "vue";
import type { Contract, Plot } from "../../../shared/contracts";
import { items } from "../../../shared/catalog";
const props = defineProps<{
  contracts: readonly DeepReadonly<Contract>[];
  plots: readonly Readonly<Plot>[];
  hour: number;
}>();
const emit = defineEmits<{
  sign: [id: string, plots: number[]];
  reserve: [id: string];
  unreserve: [id: string];
  deliver: [id: string];
  breach: [id: string];
}>();
const statusName = {
  offer: "待签约",
  active: "履约中",
  delivered: "已交付",
  breached: "已违约",
  expired: "已超期",
};
const picked = reactive<Record<string, number[]>>({});
const total = (c: DeepReadonly<Contract>) =>
  c.deposit + c.paySow + c.payHarvest + c.payDeliver;
const stages = (c: DeepReadonly<Contract>) =>
  [
    ["订金", c.status !== "offer"],
    ["播种", c.sowPaid],
    ["检验", c.harvestPaid],
    ["交付", c.deliveryPaid],
  ] as const;
const toggle = (c: DeepReadonly<Contract>, id: number) => {
  const plot = props.plots[id];
  if (!plot || plot.crop || plot.contract) return;
  const list = (picked[c.id] ??= []);
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else if (list.length < c.plotCount) list.push(id);
};
const sign = (c: DeepReadonly<Contract>) => {
  emit("sign", c.id, [...(picked[c.id] ?? [])]);
  picked[c.id] = [];
};
</script>
<template>
  <section class="panel contracts-panel">
    <div class="panel-heading">
      <h2>种植合同</h2>
      <span>村民预付 · 定向履约</span>
    </div>
    <article
      v-for="c in contracts"
      :key="c.id"
      class="order-card contract-card"
      :class="c.status"
    >
      <div class="order-icon">{{ items[c.item].icon }}</div>
      <div class="order-info">
        <strong
          >{{ items[c.item].name }} ×{{ c.quantity }}
          <em>{{ "★".repeat(c.minQuality) }}起</em></strong
        ><small
          >{{ c.id }} · {{ statusName[c.status] }} ·
          <template v-if="c.status === 'offer'">期限 {{ c.duration }}h</template>
          <template v-else>剩 {{ Math.max(0, c.deadline - hour) }}h</template></small
        ><small
          >订金¥{{ c.deposit }} · 播种¥{{ c.paySow }} · 检验¥{{
            c.payHarvest
          }}
          · 交付¥{{ c.payDeliver }}</small
        ><small v-if="c.status === 'offer'"
          >锁 {{ c.plotCount }} 块空田 · 种 {{ items[c.crop].name }} · 需合格
          {{ c.cropNeed }} 份</small
        ><small v-else
          >田块 {{ c.plots.map((p) => p + 1).join("、") }} · 种
          {{ items[c.crop].name }} · 合格
          {{ Math.min(c.qualified, c.cropNeed) }}/{{ c.cropNeed }}</small
        >
        <div v-if="c.status !== 'offer'" class="stage-line">
          <span
            v-for="[name, done] in stages(c)"
            :key="name"
            :class="{ done }"
            >{{ name }}{{ done ? " ✓" : " …" }}</span
          >
        </div>
      </div>
      <b class="reward">¥{{ total(c) }}</b>
      <div v-if="c.status === 'offer'" class="plot-picker">
        <button
          v-for="p in plots"
          :key="p.id"
          :disabled="!!p.crop || !!p.contract"
          :class="{ picked: picked[c.id]?.includes(p.id) }"
          @click="toggle(c, p.id)"
        >
          {{ p.id + 1 }}
        </button>
        <small
          >选择 {{ c.plotCount }} 块空田（已选
          {{ picked[c.id]?.length ?? 0 }}/{{ c.plotCount }}）</small
        >
      </div>
      <div class="order-actions">
        <template v-if="c.status === 'offer'">
          <button
            class="primary"
            :disabled="(picked[c.id]?.length ?? 0) !== c.plotCount"
            @click="sign(c)"
          >
            签约 · 收订金 ¥{{ c.deposit }}
          </button>
        </template>
        <template v-else-if="c.status === 'active'">
          <button v-if="!c.reservation" @click="$emit('reserve', c.id)">
            备货</button
          ><template v-else>
            <button class="primary" @click="$emit('deliver', c.id)">
              交付</button
            ><button @click="$emit('unreserve', c.id)">取消备货</button>
          </template>
          <button class="danger" @click="$emit('breach', c.id)">违约</button>
        </template>
      </div>
    </article>
    <p class="hint">
      签约即收订金并锁定所选田块；合同作物专供履约与专作加工，不可出售。播种、检验、交付三段验收各放款一次。
    </p>
  </section>
</template>
