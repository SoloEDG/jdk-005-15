import { ref } from "vue";
import { createClock, createEngine } from "../features/clock";
import { createFields } from "../features/fields";
import { createWarehouse } from "../features/warehouse";
import { createWorkshop } from "../features/workshop";
import { createOrders, salePrice } from "../features/orders";
import { createContracts } from "../features/contracts";
import { items } from "../shared/catalog";
import { saveFarm, loadFarm } from "./persistence";
export function createWorkspace() {
  const notices = ref<string[]>(["欢迎回到青禾农场。先备一份胡萝卜订单吧。"]);
  const notice = (message: string) => {
    notices.value = [message, ...notices.value].slice(0, 12);
  };
  const clock = createClock();
  const warehouse = createWarehouse(() => clock.state.hour, notice);
  const orders = createOrders(warehouse, notice, clock.state.hour);
  const contracts = createContracts(
    {
      earn: orders.earn,
      charge: orders.charge,
      credit: orders.credit,
      lockPlots: (ids, id) => fields.lockPlots(ids, id),
      releasePlots: (id, onlyUnused) => fields.releasePlots(id, onlyUnused),
      allPlantedWith: (id, crop) => fields.allPlantedWith(id, crop),
      reserve: (owner, item, n, minQuality, contract) =>
        warehouse.reserve(owner, item, n, minQuality, contract),
      consume: warehouse.consume,
      release: warehouse.release,
      abortJobs: (id) => workshop.abortContract(id),
    },
    notice,
  );
  const fields = createFields(
    orders.spend,
    (item, n, q, contract) => {
      warehouse.add(
        item,
        n,
        q,
        undefined,
        contract ? "合同田收获" : undefined,
        contract,
      );
      if (contract) contracts.inspect(contract, q, n);
    },
    notice,
    {
      contractCrop: (id) => contracts.cropOf(id),
      onSow: (id) => contracts.onSow(id),
    },
  );
  const workshop = createWorkshop(
    {
      ...warehouse,
      spend: orders.spend,
      contractActive: (id) => contracts.isActive(id),
    },
    notice,
  );
  const engine = createEngine(
    () => clock.state.hour,
    clock.setHour,
    (t) => {
      warehouse.tick(t.to);
      fields.tick(t);
      workshop.tick(t.to);
      orders.tick(t.to);
      contracts.tick(t.to);
    },
  );
  const snapshot = () => ({
    clock: clock.snapshot(),
    warehouse: warehouse.snapshot(),
    fields: fields.snapshot(),
    workshop: workshop.snapshot(),
    orders: orders.snapshot(),
    contracts: contracts.snapshot(),
  });
  return {
    clock,
    warehouse,
    fields,
    workshop,
    orders,
    contracts,
    engine,
    notices,
    sell(id: string) {
      const item = warehouse.sell(id, 1);
      if (item) {
        orders.earn(salePrice(items[item].value));
        notice(`出售${items[item].name} 1 份`);
      }
    },
    save() {
      try {
        saveFarm(snapshot());
        notice("已保存到本机");
      } catch {
        notice("保存失败，本机空间不足");
      }
    },
    load() {
      try {
        const data = loadFarm<ReturnType<typeof snapshot>>();
        if (!data) {
          notice("还没有本机存档");
          return;
        }
        clock.restore(data.clock);
        warehouse.restore(data.warehouse);
        fields.restore(data.fields);
        workshop.restore(data.workshop);
        orders.restore(data.orders);
        if (data.contracts) contracts.restore(data.contracts);
        notice("已恢复保存时刻");
      } catch {
        notice("存档损坏，无法恢复");
      }
    },
  };
}
