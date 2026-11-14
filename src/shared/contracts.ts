export type Item =
  | "carrot"
  | "corn"
  | "berry"
  | "jam"
  | "flour"
  | "shovel"
  | "axe"
  | "pick";
export type Weather = "sun" | "rain" | "wind";
export interface Crop {
  item: Item;
  planted: number;
  growth: number;
  water: number;
  stress: number;
  harvests: number;
}
export interface Plot {
  id: string;
  crop: Crop | null;
}
/** 地块地貌：沃土即可耕种田块，其余均为待开垦地貌 */
export type TerrainType =
  | "fertile"
  | "grass"
  | "wasteland"
  | "rocky"
  | "forest";
export interface TerrainTile {
  /** 由坐标推导的稳定 ID，地图扩宽后旧坐标身份不变 */
  id: string;
  x: number;
  y: number;
  terrain: TerrainType;
  /** 荒地起伏高度 1-3，影响开垦造价与工期 */
  elevation: number;
}
export type ProjectStatus = "planned" | "ready" | "building" | "done";
export interface ReclaimProject {
  id: string;
  tileId: string;
  status: ProjectStatus;
  tool: Item;
  toolQty: number;
  coinCost: number;
  duration: number;
  /** 计划确认时托管的资金，取消未开工计划时全额退还 */
  escrow: number;
  /** 工具到货后在谷仓建立的占用凭据 */
  reservation?: string;
  /** 开工时刻与完工时刻 */
  started?: number;
  finish?: number;
  /** 确认计划时预览并冻结的施工路径（格子 ID 序列） */
  path: string[];
}
export interface Receipt {
  quality: number;
  sources: readonly string[];
  quantity: number;
}
export interface Batch {
  id: string;
  item: Item;
  quantity: number;
  quality: number;
  source: string;
  expires: number;
}
export interface Allocation {
  batch: string;
  quantity: number;
}
export interface Reservation {
  id: string;
  owner: string;
  allocations: Allocation[];
}
export interface Job {
  id: string;
  recipe: string;
  reservation: string;
  receipt?: Receipt;
  finish: number;
  status: "queued" | "ready" | "claimed" | "failed";
}
export interface Order {
  id: string;
  item: Item;
  quantity: number;
  reward: number;
  minQuality: number;
  deadline: number;
  status: "open" | "reserved" | "delivered" | "expired";
  reservation?: string;
}
export interface Tick {
  from: number;
  to: number;
  weather: Weather;
}
/** 递归只读，用于 readonly(reactive) 状态在组件 props 上的类型表达 */
export type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K];
};
export type Notice = (message: string) => void;
