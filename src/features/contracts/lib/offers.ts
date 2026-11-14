import type { Contract, Item } from "../../../shared/contracts";
import { items } from "../../../shared/catalog";
import { crops } from "../../fields/lib/crops";
import { recipes } from "../../workshop/lib/recipes";
const cropFor = (item: Item): Item =>
  recipes.find((r) => r.output === item)?.input ?? item;
const cropNeedFor = (item: Item, quantity: number): number => {
  const recipe = recipes.find((r) => r.output === item);
  return recipe
    ? Math.ceil(quantity / recipe.quantity) * recipe.amount
    : quantity;
};
const split = (total: number): [number, number, number, number] => {
  const deposit = Math.round(total * 0.25),
    sow = Math.round(total * 0.15),
    harvest = Math.round(total * 0.25);
  return [deposit, sow, harvest, total - deposit - sow - harvest];
};
function make(
  serial: number,
  item: Item,
  quantity: number,
  minQuality: number,
): Contract {
  const crop = cropFor(item),
    def = crops[crop]!,
    cropNeed = cropNeedFor(item, quantity),
    perPlot = def.yield * (1 + def.repeat),
    processed = crop !== item,
    [deposit, paySow, payHarvest, payDeliver] = split(
      Math.round(items[item].value * quantity * 1.8),
    );
  return {
    id: `c${serial}`,
    item,
    crop,
    quantity,
    cropNeed,
    minQuality,
    duration: def.duration * 2 + 48 + (processed ? 12 : 0),
    deadline: 0,
    plotCount: Math.max(1, Math.min(3, Math.ceil(cropNeed / perPlot))),
    plots: [],
    deposit,
    paySow,
    payHarvest,
    payDeliver,
    status: "offer",
    sowPaid: false,
    harvestPaid: false,
    deliveryPaid: false,
    qualified: 0,
  };
}
export function initialContracts(): Contract[] {
  return [make(1, "carrot", 5, 1), make(2, "jam", 2, 2)];
}
export function nextContract(serial: number): Contract {
  const rotation: Item[] = ["corn", "berry", "flour", "carrot", "jam"],
    item = rotation[serial % rotation.length]!,
    processed = cropFor(item) !== item;
  return make(
    serial,
    item,
    processed ? 2 + (serial % 2) : 4 + (serial % 3),
    serial % 2 === 0 ? 2 : 1,
  );
}
