// 领域集成测试：用真实 Vue 响应式跑通开垦全流程与存档身份稳定性
import assert from "node:assert";
import { createFields } from "../src/features/fields/model/store";
import { generateWorld, findPath, tileId, HOME_RECT, plotIdOf } from "../src/features/map/lib/world";

let coins = 180;
const reservations = new Map();
const batches = [];
let serial = 0;
const notice = () => {};

const ports = {
  spend: (n) => {
    if (coins < n) return false;
    coins -= n;
    return true;
  },
  refund: (n) => {
    coins += n;
  },
  reserve: (owner, item, n) => {
    const stock = batches
      .filter((b) => b.item === item)
      .reduce((s, b) => s + b.qty, 0);
    const used = [...reservations.values()]
      .filter((r) => r.item === item)
      .reduce((s, r) => s + r.qty, 0);
    if (stock - used < n) return null;
    const id = `r${++serial}`;
    reservations.set(id, { owner, item, qty: n });
    return id;
  },
  consume: (id) => {
    const r = reservations.get(id);
    if (!r) return null;
    let left = r.qty;
    for (const b of batches)
      if (b.item === r.item && left > 0) {
        const take = Math.min(left, b.qty);
        b.qty -= take;
        left -= take;
      }
    reservations.delete(id);
    return { quality: 1, sources: ["test"], quantity: r.qty };
  },
  release: (id) => reservations.delete(id),
};
const harvest = () => {};

const fields = createFields(ports, harvest, notice);

// 1. 初始 12 块沃土，ID 稳定且与坐标绑定
assert.equal(fields.state.plots.length, 12, "初始 12 块地");
assert.equal(
  fields.state.plots[0].id,
  plotIdOf(HOME_RECT.x0, HOME_RECT.y0),
  "首块地 ID 绑定坐标",
);
const initialIds = fields.state.plots.map((p) => p.id);

// 2. 地图 81 格，中心 12 格为沃土
const world = generateWorld();
assert.equal(world.length, 81, "9x9 地图");
assert.equal(world.filter((t) => t.terrain === "fertile").length, 12);

// 3. 找一块与沃土相邻的非沃土格子，验证路径
const isReclaimed = (id) =>
  fields.state.tiles.find((t) => t.id === id)?.terrain === "fertile";
const target = fields.state.tiles.find(
  (t) => t.terrain !== "fertile" && findPath(t, fields.state.tiles, isReclaimed),
);
assert.ok(target, "存在可达的待开垦格子");
const preview = fields.preview(target.id);
assert.ok(preview && preview.path.length >= 2, "预览返回含起点与目标的路径");

// 4. 确认计划：资金托管，工具未到货前保持 planned
const coinsBefore = coins;
fields.planReclaim(target.id);
const project = fields.state.projects.find((p) => p.tileId === target.id);
assert.ok(project, "计划已建立");
assert.equal(project.status, "planned");
assert.equal(coins, coinsBefore - project.coinCost, "资金已托管");
assert.equal(project.escrow, project.coinCost);

// 5. 无工具时 tick 不推进状态、不重复收费
fields.tick({ from: 6, to: 7, weather: "sun" });
assert.equal(project.status, "planned");
assert.equal(fields.state.projects.filter((p) => p.tileId === target.id).length, 1);

// 6. 工具到货后 tick 自动锁定为 ready
batches.push({ id: `b${++serial}`, item: project.tool, qty: 5 });
fields.tick({ from: 7, to: 8, weather: "sun" });
assert.equal(project.status, "ready", "工具到货自动锁定");
assert.ok(project.reservation, "已建立工具占用凭据");
assert.equal(reservations.has(project.reservation), true);

// 7. 资金不足时无法建立新计划（不产生半收费）
const otherTarget = fields.state.tiles.find(
  (t) =>
    t.terrain !== "fertile" &&
    t.id !== target.id &&
    findPath(t, fields.state.tiles, isReclaimed),
);
coins = 0;
const projectsBefore = fields.state.projects.length;
fields.planReclaim(otherTarget.id);
assert.equal(fields.state.projects.length, projectsBefore, "资金不足不建计划");
coins = 500;

// 8. 开工 -> 完工：工具被消耗、地貌变沃土、新田块以稳定 ID 发放
fields.startBuild(project.id, 8);
assert.equal(project.status, "building");
const toolBefore = batches
  .filter((b) => b.item === project.tool)
  .reduce((s, b) => s + b.qty, 0);
fields.tick({ from: 8, to: 8 + project.duration, weather: "sun" });
assert.equal(
  fields.state.tiles.find((t) => t.id === target.id)?.terrain,
  "fertile",
  "完工后地貌变沃土",
);
const newPlot = fields.state.plots.find((p) => p.id === plotIdOf(target.x, target.y));
assert.ok(newPlot, "新田块按坐标 ID 发放");
assert.equal(fields.state.plots.length, 13);
const toolAfter = batches
  .filter((b) => b.item === project.tool)
  .reduce((s, b) => s + b.qty, 0);
assert.equal(toolAfter, toolBefore - project.toolQty, "工具已实际消耗");

// 9. 新田块可播种、生长（与是否在屏幕分块无关）
fields.selectPlot(newPlot.id);
assert.equal(fields.state.activePlotId, newPlot.id);
fields.plant(newPlot.id, 10);
assert.ok(newPlot.crop, "新田块可播种");
const growthBefore = newPlot.crop.growth;
fields.tick({ from: 10, to: 15, weather: "rain" });
assert.ok(newPlot.crop.growth > growthBefore, "作物随统一时间生长");

// 10. 再建一个计划并在未开工时取消：全额退款、释放工具占用
const target2 = fields.state.tiles.find(
  (t) =>
    t.terrain !== "fertile" &&
    findPath(t, fields.state.tiles, isReclaimed) &&
    !fields.state.projects.some((p) => p.tileId === t.id),
);
const coinsAtPlan = coins;
fields.planReclaim(target2.id);
const p2 = fields.state.projects.find((p) => p.tileId === target2.id);
fields.tick({ from: 15, to: 16, weather: "sun" }); // 工具锁定
assert.equal(p2.status, "ready");
const reservedCount = reservations.size;
fields.cancelProject(p2.id);
assert.equal(coins, coinsAtPlan, "取消后全额退款");
assert.equal(reservations.size, reservedCount - 1, "工具占用已释放");
assert.equal(
  fields.state.tiles.find((t) => t.id === target2.id)?.terrain !== "fertile",
  true,
  "取消不动地貌（未清除任何障碍）",
);

// 11. 施工中的计划不可取消
const target3 = fields.state.tiles.find(
  (t) =>
    t.terrain !== "fertile" &&
    findPath(t, fields.state.tiles, isReclaimed) &&
    !fields.state.projects.some((p) => p.tileId === t.id),
);
fields.planReclaim(target3.id);
const p3 = fields.state.projects.find((p) => p.tileId === target3.id);
fields.tick({ from: 16, to: 17, weather: "sun" });
fields.startBuild(p3.id, 17);
const coinsBeforeCancel = coins;
fields.cancelProject(p3.id);
assert.ok(fields.state.projects.some((p) => p.id === p3.id), "施工中不可取消");
assert.equal(coins, coinsBeforeCancel, "施工中取消不退款");

// 12. 存档恢复后身份不串：模拟拓宽（tiles 不变）+ 恢复
const snap = fields.snapshot();
const restored = createFields(ports, harvest, notice);
restored.restore(snap);
const restoredIds = restored.state.plots.map((p) => p.id);
assert.ok(
  initialIds.every((id) => restoredIds.includes(id)),
  "原有田块 ID 全部保留",
);
assert.ok(restoredIds.includes(newPlot.id), "新开垦田块 ID 保留");
// 作物仍挂在同一稳定 ID 上
const restoredNewPlot = restored.state.plots.find((p) => p.id === newPlot.id);
assert.ok(restoredNewPlot?.crop, "作物跟随稳定 ID，不按数组位置串地");
assert.equal(restored.state.activePlotId, newPlot.id, "选中土地身份保留");

// 13. 旧版 v1 存档迁移：数字下标 -> 坐标 ID
const legacy = {
  plots: [
    { id: 0, crop: null },
    { id: 1, crop: { item: "carrot", planted: 6, growth: 3, water: 80, stress: 0, harvests: 0 } },
  ],
  selected: "carrot",
};
const migrated = createFields(ports, harvest, notice);
migrated.restore(legacy);
assert.equal(migrated.state.plots[0].id, plotIdOf(HOME_RECT.x0, HOME_RECT.y0));
assert.equal(
  migrated.state.plots[1].id,
  plotIdOf(HOME_RECT.x0 + 1, HOME_RECT.y0),
  "旧下标 1 迁移到第二列坐标",
);
assert.ok(migrated.state.plots[1].crop, "迁移保留作物");
assert.equal(migrated.state.tiles.length, 81, "迁移补全地图");

console.log("全部集成测试通过 ✅");
