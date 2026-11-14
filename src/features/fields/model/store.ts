import { reactive, readonly } from "vue";
import type {
  Item,
  Plot,
  Tick,
  Notice,
  TerrainTile,
  ReclaimProject,
  Receipt,
} from "../../../shared/contracts";
import { crops, grow, ready } from "../lib/crops";
import {
  generateWorld,
  reclaimRecipe,
  findPath,
  tileBusy,
  plotIdOf,
  HOME_RECT,
} from "../../map/lib/world";

interface Ports {
  spend: (amount: number) => boolean;
  refund: (amount: number) => void;
  reserve: (owner: string, item: Item, n: number) => string | null;
  consume: (id: string) => Receipt | null;
  release: (id: string) => void;
}

function homePlots(): Plot[] {
  const plots: Plot[] = [];
  for (let y = HOME_RECT.y0; y <= HOME_RECT.y1; y++)
    for (let x = HOME_RECT.x0; x <= HOME_RECT.x1; x++)
      plots.push({ id: plotIdOf(x, y), crop: null });
  return plots;
}

export function createFields(
  ports: Ports,
  harvest: (item: Item, n: number, q: number) => void,
  notice: Notice,
) {
  const state = reactive({
    /** 田块以字符串 ID 稳定标识，与地图坐标一一绑定，不随数组位置变化 */
    plots: homePlots(),
    selected: "carrot" as Item,
    /** 当前选中的田块 ID（不再是数组下标） */
    activePlotId: plotIdOf(HOME_RECT.x0, HOME_RECT.y0),
    /** 整张地图的固定地貌，扩宽后旧坐标身份不变 */
    tiles: generateWorld(),
    /** 开垦计划：资金托管、工具占用与施工进度 */
    projects: [] as ReclaimProject[],
    serial: 0,
  });

  const plotById = (id: string) => state.plots.find((p) => p.id === id);
  const tileById = (id: string) => state.tiles.find((t) => t.id === id);
  const isReclaimed = (id: string) =>
    state.tiles.find((t) => t.id === id)?.terrain === "fertile";

  const fields = {
    state: readonly(state),
    select: (item: Item) => {
      state.selected = item;
    },
    selectPlot: (id: string) => {
      if (plotById(id)) state.activePlotId = id;
    },
    plant(plotId: string, hour: number) {
      const plot = plotById(plotId);
      const seed = crops[state.selected];
      if (!plot || plot.crop || !seed) return;
      if (!ports.spend(seed.cost)) {
        notice("资金不足，交付订单或出售库存后再试");
        return;
      }
      plot.crop = {
        item: state.selected,
        planted: hour,
        growth: 0,
        water: 70,
        stress: 0,
        harvests: 0,
      };
      notice("种下了新的希望");
    },
    water(plotId: string) {
      const c = plotById(plotId)?.crop;
      if (c) c.water = 100;
    },
    harvest(plotId: string) {
      const plot = plotById(plotId);
      const crop = plot?.crop;
      if (!crop || !ready(crop)) return;
      const def = crops[crop.item]!;
      harvest(crop.item, def.yield, crop.stress <= 2 ? 2 : 1);
      if (crop.harvests < def.repeat) {
        crop.growth = 0;
        crop.harvests++;
      } else plot.crop = null;
      notice("收获已按品质分批入仓");
    },
    /** 预览开垦：返回配方与冻结前的施工路径，不产生任何扣费或占用 */
    preview(tileIdValue: string) {
      const tile = tileById(tileIdValue);
      if (!tile || tile.terrain === "fertile" || tileBusy(state.projects, tile.id))
        return null;
      const path = findPath(tile, state.tiles, isReclaimed);
      if (!path) return null;
      return { tile, recipe: reclaimRecipe(tile), path };
    },
    /** 确认开垦计划：校验通过后一次性托管资金并登记工具需求，杜绝半收费状态 */
    planReclaim(tileIdValue: string) {
      const plan = fields.preview(tileIdValue);
      if (!plan) {
        notice("这里暂时无法开垦：需要与已开垦土地相邻且路径可达");
        return;
      }
      const { tile, recipe, path } = plan;
      if (!ports.spend(recipe.coinCost)) {
        notice("资金不足，无法托管开垦费用");
        return;
      }
      state.projects.push({
        id: `rc${++state.serial}`,
        tileId: tile.id,
        status: "planned",
        tool: recipe.tool,
        toolQty: recipe.toolQty,
        coinCost: recipe.coinCost,
        duration: recipe.duration,
        escrow: recipe.coinCost,
        path,
      });
      notice(`已托管 ¥${recipe.coinCost}，等待 ${recipe.toolQty} 件工具到货`);
    },
    /** 取消未开工的计划：释放工具占用并全额退还托管资金，已清除的地貌变化不回滚 */
    cancelProject(id: string) {
      const project = state.projects.find((p) => p.id === id);
      if (!project || project.status === "building" || project.status === "done")
        return;
      if (project.reservation) ports.release(project.reservation);
      ports.refund(project.escrow);
      state.projects = state.projects.filter((p) => p.id !== id);
      notice(`计划已取消，托管资金 ¥${project.escrow} 已全额退回`);
    },
    /** 工具到货锁定后开工 */
    startBuild(id: string, hour: number) {
      const project = state.projects.find((p) => p.id === id);
      if (!project || project.status !== "ready" || !project.reservation) return;
      project.status = "building";
      project.started = hour;
      project.finish = hour + project.duration;
      notice("施工开始，障碍清理中");
    },
    tick(tick: Tick) {
      // 所有田块统一走时间生长，与是否在当前屏幕分块无关
      for (const plot of state.plots)
        if (plot.crop)
          plot.crop = grow(plot.crop, tick.weather, tick.to - tick.from);

      for (const project of state.projects) {
        // 计划中的项目：工具一旦有货立即占用锁定
        if (project.status === "planned") {
          const reservation = ports.reserve(
            `reclaim:${project.id}`,
            project.tool,
            project.toolQty,
          );
          if (reservation) {
            project.reservation = reservation;
            project.status = "ready";
            notice("工具已到货并锁定，可以开工了");
          }
        }
        // 施工完工：消耗工具、变更地貌、发放具有稳定 ID 的新田块
        if (
          project.status === "building" &&
          project.finish !== undefined &&
          project.finish <= tick.to
        ) {
          const receipt = project.reservation
            ? ports.consume(project.reservation)
            : null;
          if (!receipt) {
            // 工具异常缺失时全额退款，绝不留下收费却不可用的土地
            ports.refund(project.escrow);
            state.projects = state.projects.filter((p) => p.id !== project.id);
            notice("施工工具缺失，已取消计划并全额退款");
            continue;
          }
          const tile = tileById(project.tileId);
          if (tile) {
            tile.terrain = "fertile";
            tile.elevation = 0;
            state.plots.push({ id: plotIdOf(tile.x, tile.y), crop: null });
          }
          project.status = "done";
          state.projects = state.projects.filter((p) => p.id !== project.id);
          notice("开垦完成，新田块已可播种");
        }
      }
    },
    snapshot: () => JSON.parse(JSON.stringify(state)) as typeof state,
    restore: (data: unknown) => {
      const migrated = migrate(data);
      Object.assign(state, migrated);
      if (!state.activePlotId)
        state.activePlotId =
          state.plots[0]?.id ?? plotIdOf(HOME_RECT.x0, HOME_RECT.y0);
    },
  };
  return fields;
}

/** 旧版（v1，数字下标田块）存档迁移：按原顺序映射到初始沃土坐标 */
function migrate(data: unknown): any {
  if (!data || typeof data !== "object") return data;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.tiles)) d.tiles = generateWorld();
  if (!Array.isArray(d.projects)) d.projects = [];
  if (d.serial === undefined) d.serial = 0;
  if (Array.isArray(d.plots)) {
    const cols = HOME_RECT.x1 - HOME_RECT.x0 + 1;
    d.plots = d.plots.map((raw: unknown, index: number) => {
      const plot = raw as Plot & { id: number | string };
      if (typeof plot.id === "number") {
        const x = HOME_RECT.x0 + (index % cols);
        const y = HOME_RECT.y0 + Math.floor(index / cols);
        return { ...plot, id: plotIdOf(x, y) };
      }
      return plot;
    });
  }
  return d;
}

export type FieldsApi = ReturnType<typeof createFields>;
export type { TerrainTile };
