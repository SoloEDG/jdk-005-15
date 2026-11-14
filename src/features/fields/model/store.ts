import { reactive, readonly } from "vue";
import type { Item, Plot, Tick, Notice } from "../../../shared/contracts";
import { crops, grow, ready } from "../lib/crops";
interface Links {
  contractCrop: (contract: string) => Item | null;
  onSow: (contract: string) => void;
}
export function createFields(
  spend: (amount: number) => boolean,
  harvest: (item: Item, n: number, q: number, contract?: string) => void,
  notice: Notice,
  links: Links,
) {
  const state = reactive({
    plots: Array.from({ length: 12 }, (_, id): Plot => ({ id, crop: null })),
    selected: "carrot" as Item,
  });
  return {
    state: readonly(state),
    select: (item: Item) => {
      state.selected = item;
    },
    plant(id: number, hour: number) {
      const plot = state.plots[id];
      if (!plot || plot.crop) return;
      let bound: Item | null = null;
      if (plot.contract) {
        bound = links.contractCrop(plot.contract);
        if (!bound) plot.contract = null;
      }
      const item = bound ?? state.selected,
        seed = crops[item];
      if (!seed) return;
      if (!spend(seed.cost)) {
        notice("资金不足，交付订单或出售库存后再试");
        return;
      }
      plot.crop = {
        item,
        planted: hour,
        growth: 0,
        water: 70,
        stress: 0,
        harvests: 0,
      };
      if (bound && plot.contract) {
        links.onSow(plot.contract);
        notice("合同田块已按约播种");
      } else notice("种下了新的希望");
    },
    water(id: number) {
      const c = state.plots[id]?.crop;
      if (c) c.water = 100;
    },
    harvest(id: number) {
      const plot = state.plots[id],
        crop = plot?.crop;
      if (!crop || !ready(crop)) return;
      const def = crops[crop.item]!;
      harvest(
        crop.item,
        def.yield,
        crop.stress <= 2 ? 2 : 1,
        plot.contract ?? undefined,
      );
      if (crop.harvests < def.repeat) {
        crop.growth = 0;
        crop.harvests++;
      } else plot.crop = null;
      notice(
        plot.contract
          ? "合同作物已入仓，专供履约"
          : "收获已按品质分批入仓",
      );
    },
    lockPlots(ids: number[], contract: string) {
      const plots = ids.map((id) => state.plots[id]);
      if (plots.some((p) => !p || p.crop || p.contract)) return false;
      for (const p of plots) p!.contract = contract;
      return true;
    },
    releasePlots(contract: string, onlyUnused: boolean) {
      for (const p of state.plots)
        if (p.contract === contract && (!onlyUnused || !p.crop))
          p.contract = null;
    },
    allPlantedWith(contract: string, item: Item) {
      const locked = state.plots.filter((p) => p.contract === contract);
      return (
        locked.length > 0 && locked.every((p) => p.crop?.item === item)
      );
    },
    tick(tick: Tick) {
      for (const plot of state.plots)
        if (plot.crop)
          plot.crop = grow(plot.crop, tick.weather, tick.to - tick.from);
    },
    snapshot: () => JSON.parse(JSON.stringify(state)) as typeof state,
    restore: (data: typeof state) => {
      Object.assign(state, data);
    },
  };
}
