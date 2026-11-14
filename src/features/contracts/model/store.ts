import { reactive, readonly } from "vue";
import type {
  Contract,
  Item,
  Notice,
  Receipt,
} from "../../../shared/contracts";
import { initialContracts, nextContract } from "../lib/offers";
interface Ports {
  earn: (n: number) => void;
  charge: (n: number) => void;
  credit: (xp: number) => void;
  lockPlots: (ids: number[], contract: string) => boolean;
  releasePlots: (contract: string, onlyUnused: boolean) => void;
  allPlantedWith: (contract: string, crop: Item) => boolean;
  reserve: (
    owner: string,
    item: Item,
    n: number,
    minQuality?: number,
    contract?: string,
  ) => string | null;
  consume: (id: string) => Receipt | null;
  release: (id: string) => void;
  abortJobs: (contract: string) => void;
}
export function createContracts(ports: Ports, notice: Notice) {
  const state = reactive({
    serial: 2,
    contracts: initialContracts(),
  });
  const find = (id: string) => state.contracts.find((c) => c.id === id);
  const settle = (c: Contract, status: "breached" | "expired") => {
    if (c.reservation) {
      ports.release(c.reservation);
      delete c.reservation;
    }
    ports.abortJobs(c.id);
    ports.charge(c.deposit);
    ports.releasePlots(c.id, true);
    c.status = status;
  };
  return {
    state: readonly(state),
    cropOf(id: string) {
      const c = find(id);
      return c && c.status === "active" ? c.crop : null;
    },
    isActive(id: string) {
      return find(id)?.status === "active";
    },
    sign(id: string, plots: number[], hour: number) {
      const c = find(id);
      if (!c || c.status !== "offer") return;
      if (plots.length !== c.plotCount || !ports.lockPlots(plots, c.id)) {
        notice("请按合同要求选择足量的空田块");
        return;
      }
      c.plots = [...plots];
      c.deadline = hour + c.duration;
      c.status = "active";
      ports.earn(c.deposit);
      notice(`合同 ${c.id} 已签订，村民预付订金 ¥${c.deposit}，田块已锁定`);
    },
    onSow(id: string) {
      const c = find(id);
      if (!c || c.status !== "active" || c.sowPaid) return;
      if (!ports.allPlantedWith(c.id, c.crop)) return;
      c.sowPaid = true;
      ports.earn(c.paySow);
      notice(`合同 ${c.id} 播种验收通过，村民放款 ¥${c.paySow}`);
    },
    inspect(id: string, quality: number, quantity: number) {
      const c = find(id);
      if (!c || c.status !== "active") return;
      if (quality < c.minQuality) {
        notice(`合同 ${c.id} 本批品质未达标，可在期限内补种重收`);
        return;
      }
      c.qualified += quantity;
      if (!c.harvestPaid && c.qualified >= c.cropNeed) {
        c.harvestPaid = true;
        ports.earn(c.payHarvest);
        notice(`合同 ${c.id} 收获检验通过，村民放款 ¥${c.payHarvest}`);
      } else
        notice(
          `合同 ${c.id} 合格份额 ${Math.min(c.qualified, c.cropNeed)}/${c.cropNeed}`,
        );
    },
    reserve(id: string) {
      const c = find(id);
      if (!c || c.status !== "active" || c.reservation) return;
      const reservation = ports.reserve(
        `contract:${id}`,
        c.item,
        c.quantity,
        c.minQuality,
        c.id,
      );
      if (!reservation) {
        notice("合同专供库存不足，先收获或专作加工");
        return;
      }
      c.reservation = reservation;
      notice("已锁定合同专供货物，等待交付");
    },
    unreserve(id: string) {
      const c = find(id);
      if (c?.status === "active" && c.reservation) {
        ports.release(c.reservation);
        delete c.reservation;
        notice("已取消备货，货物仍属合同专供");
      }
    },
    deliver(id: string) {
      const c = find(id);
      if (!c || c.status !== "active" || !c.reservation) return;
      const receipt = ports.consume(c.reservation);
      if (!receipt) {
        ports.release(c.reservation);
        delete c.reservation;
        notice("货物已失效，无法交付");
        return;
      }
      c.deliveryPaid = true;
      c.status = "delivered";
      ports.earn(c.payDeliver);
      ports.credit(50 + (receipt.quality > 1 ? 10 : 0));
      ports.abortJobs(c.id);
      ports.releasePlots(c.id, false);
      state.contracts.push(nextContract(++state.serial));
      notice(`合同 ${c.id} 交付完成，尾款 ¥${c.payDeliver} 已到账`);
    },
    breach(id: string) {
      const c = find(id);
      if (!c || c.status !== "active") return;
      settle(c, "breached");
      state.contracts.push(nextContract(++state.serial));
      notice(
        `合同 ${c.id} 违约结算：退回订金 ¥${c.deposit}，已用种子与加工费不予退还，未用田块已释放`,
      );
    },
    tick(hour: number) {
      let expired = 0;
      for (const c of state.contracts) {
        if (c.status === "active" && c.deadline <= hour) {
          settle(c, "expired");
          expired++;
          notice(`合同 ${c.id} 超期未交付，按违约结算：退回订金 ¥${c.deposit}`);
        } else if (c.status === "breached" || c.status === "expired")
          ports.releasePlots(c.id, true);
      }
      while (expired--) state.contracts.push(nextContract(++state.serial));
    },
    snapshot: () => JSON.parse(JSON.stringify(state)) as typeof state,
    restore: (data: typeof state) => {
      Object.assign(state, data);
    },
  };
}
