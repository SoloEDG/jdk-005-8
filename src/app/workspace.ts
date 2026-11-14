import { ref } from "vue";
import { createClock, createEngine } from "../features/clock";
import { createFields } from "../features/fields";
import { createWarehouse } from "../features/warehouse";
import { createWorkshop } from "../features/workshop";
import { createOrders, salePrice } from "../features/orders";
import { items, isTool } from "../shared/catalog";
import { saveFarm, loadFarm } from "./persistence";
export function createWorkspace() {
  const notices = ref<string[]>(["欢迎回到青禾农场。先备一份胡萝卜订单吧。"]);
  const notice = (message: string) => {
    notices.value = [message, ...notices.value].slice(0, 12);
  };
  const clock = createClock();
  const warehouse = createWarehouse(() => clock.state.hour, notice);
  const orders = createOrders(warehouse, notice, clock.state.hour);
  // 开垦端口：资金由订单账本托管/退还，工具占用走谷仓同一套预留凭据
  const fields = createFields(
    {
      spend: orders.spend,
      refund: orders.earn,
      reserve: warehouse.reserve,
      consume: warehouse.consume,
      release: warehouse.release,
    },
    warehouse.add,
    notice,
  );
  const workshop = createWorkshop(
    { ...warehouse, spend: orders.spend },
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
    },
  );
  const snapshot = () => ({
    clock: clock.snapshot(),
    warehouse: warehouse.snapshot(),
    fields: fields.snapshot(),
    workshop: workshop.snapshot(),
    orders: orders.snapshot(),
  });
  return {
    clock,
    warehouse,
    fields,
    workshop,
    orders,
    engine,
    notices,
    sell(id: string) {
      // 工具是开垦生产资料，不可出售，避免资金与工具占用状态错乱
      const batch = warehouse.state.batches.find((b) => b.id === id);
      if (batch && isTool(batch.item)) {
        notice("工具是开垦生产资料，不能出售");
        return;
      }
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
        notice("已恢复保存时刻");
      } catch {
        notice("存档损坏，无法恢复");
      }
    },
  };
}
